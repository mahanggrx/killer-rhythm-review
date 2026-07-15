import { DEFAULT_METRIC_CONFIG } from "../../config/metricThresholds";
import {
  parseMatchLogJson,
  type BaseMatchEvent,
  type MatchEvent,
  type MatchEventType,
  type MatchLog,
} from "../log";
import { calculateMatchMetrics, type NumericMetric } from "../metrics";
import {
  SYNTHETIC_LOG_LIMITS,
  type SyntheticLogInput,
  type SyntheticLogInputField,
  type SyntheticLogInputIssue,
  type SyntheticLogResult,
  type SyntheticLogVerification,
} from "./types";

const MILLISECONDS_PER_SECOND = 1000;
const SECOND_CHASE_DURATION_MS = 20_000;
const BLEED_OUT_DURATION_MS = 240_000;
const GENERATOR_PROGRESS = 0.9;
const GENERATORS = [
  "generator-1",
  "generator-2",
  "generator-3",
  "generator-4",
  "generator-5",
  "generator-6",
  "generator-7",
] as const;
const SURVIVORS = [
  "survivor-1",
  "survivor-2",
  "survivor-3",
  "survivor-4",
] as const;
const ACTIVE_GENERATOR_CONTRIBUTORS = [
  SURVIVORS[1],
  SURVIVORS[2],
  SURVIVORS[3],
] as const;

interface NumericFieldRule {
  field: SyntheticLogInputField;
  label: string;
  minimum: number;
  maximum: number;
}

const NUMERIC_FIELD_RULES: readonly NumericFieldRule[] = [
  {
    field: "averageChaseGapSeconds",
    label: "平均追逐空窗",
    minimum: SYNTHETIC_LOG_LIMITS.minimumSeconds,
    maximum: SYNTHETIC_LOG_LIMITS.maximumSeconds,
  },
  {
    field: "firstChaseDurationSeconds",
    label: "首次追逐持续时间",
    minimum: SYNTHETIC_LOG_LIMITS.minimumFirstChaseSeconds,
    maximum: SYNTHETIC_LOG_LIMITS.maximumSeconds,
  },
  {
    field: "generatorsRemainingAtFirstElimination",
    label: "首次减员时剩余发电机",
    minimum: SYNTHETIC_LOG_LIMITS.minimumGeneratorsRemaining,
    maximum: SYNTHETIC_LOG_LIMITS.maximumGeneratorsRemaining,
  },
] as const;

export function validateSyntheticLogInput(
  input: Readonly<SyntheticLogInput>,
): SyntheticLogInputIssue[] {
  const issues: SyntheticLogInputIssue[] = [];

  for (const rule of NUMERIC_FIELD_RULES) {
    const value = input[rule.field];

    if (!Number.isFinite(value)) {
      issues.push({
        field: rule.field,
        code: "NOT_FINITE",
        message: `${rule.label}必须是有限数值。`,
      });
      continue;
    }

    if (!Number.isInteger(value)) {
      issues.push({
        field: rule.field,
        code: "NOT_INTEGER",
        message: `${rule.label}必须使用整数。`,
      });
      continue;
    }

    if (value < rule.minimum || value > rule.maximum) {
      issues.push({
        field: rule.field,
        code: "OUT_OF_RANGE",
        message: `${rule.label}必须在 ${rule.minimum} 到 ${rule.maximum} 之间。`,
      });
    }
  }

  return issues;
}

function availableValue(metric: NumericMetric): number | null {
  return metric.status === "available" ? metric.value : null;
}

function buildLog(input: Readonly<SyntheticLogInput>): MatchLog {
  const firstChaseStartMs =
    input.averageChaseGapSeconds * MILLISECONDS_PER_SECOND;
  const firstChaseEndMs = firstChaseStartMs
    + input.firstChaseDurationSeconds * MILLISECONDS_PER_SECOND;
  const secondChaseStartMs = firstChaseEndMs
    + input.averageChaseGapSeconds * MILLISECONDS_PER_SECOND;
  const secondChaseEndMs = secondChaseStartMs + SECOND_CHASE_DURATION_MS;
  const completedGeneratorCount =
    SYNTHETIC_LOG_LIMITS.maximumGeneratorsRemaining
    - input.generatorsRemainingAtFirstElimination;
  const firstEliminationMs = Math.max(
    secondChaseEndMs + (completedGeneratorCount + 1) * 15_000,
    firstChaseEndMs + BLEED_OUT_DURATION_MS,
  );
  const durationMs = firstEliminationMs + 60_000;
  const events: MatchEvent[] = [];
  let eventOrder = 0;

  const nextBase = <TType extends MatchEventType>(
    timestampMs: number,
    type: TType,
  ): BaseMatchEvent<TType> => {
    const currentOrder = eventOrder;
    eventOrder += 1;

    return {
      eventId: `syn-${String(currentOrder + 1).padStart(3, "0")}`,
      timestampMs,
      eventOrder: currentOrder,
      type,
    };
  };

  events.push(nextBase(0, "trial_start"));
  events.push({
    ...nextBase(firstChaseStartMs, "chase_start"),
    chaseId: "chase-1",
    survivorId: SURVIVORS[0],
    source: "game_state",
  });
  events.push({
    ...nextBase(
      firstChaseStartMs
        + Math.floor((firstChaseEndMs - firstChaseStartMs) / 2),
      "survivor_injured",
    ),
    survivorId: SURVIVORS[0],
    fromState: "healthy",
    cause: "basic_attack",
    sourceId: "killer",
  });
  events.push({
    ...nextBase(firstChaseEndMs, "survivor_downed"),
    survivorId: SURVIVORS[0],
    fromState: "injured",
    cause: "basic_attack",
    attribution: "killer",
    sourceId: "killer",
  });
  events.push({
    ...nextBase(firstChaseEndMs, "chase_end"),
    chaseId: "chase-1",
    survivorId: SURVIVORS[0],
    endReason: "target_downed",
    censored: false,
    policyGenerated: false,
  });
  events.push({
    ...nextBase(secondChaseStartMs, "chase_start"),
    chaseId: "chase-2",
    survivorId: SURVIVORS[1],
    source: "game_state",
  });
  events.push({
    ...nextBase(secondChaseEndMs, "chase_end"),
    chaseId: "chase-2",
    survivorId: SURVIVORS[1],
    endReason: "target_switch",
    censored: false,
    policyGenerated: false,
  });

  for (let index = 0; index < completedGeneratorCount; index += 1) {
    const progressTimestampMs = secondChaseEndMs + (index + 1) * 10_000;
    const completionTimestampMs = progressTimestampMs + 2_000;
    const generatorId = GENERATORS[index];
    const contributorId = ACTIVE_GENERATOR_CONTRIBUTORS[
      index % ACTIVE_GENERATOR_CONTRIBUTORS.length
    ];

    events.push({
      ...nextBase(progressTimestampMs, "generator_repair_stopped"),
      generatorId,
      survivorId: contributorId,
      progress: GENERATOR_PROGRESS,
      reason: "voluntary",
    });
    events.push({
      ...nextBase(completionTimestampMs, "generator_completed"),
      generatorId,
      completionIndex: index + 1,
      progress: 1,
      contributors: [contributorId],
    });
  }

  events.push({
    ...nextBase(firstEliminationMs, "survivor_outcome"),
    survivorId: SURVIVORS[0],
    outcomeType: "bled_out",
    cause: "bleedout_timer",
    attribution: "killer",
  });
  events.push({
    ...nextBase(durationMs, "trial_end"),
    reason: "fixture_complete",
    normalEnd: true,
  });

  return {
    schemaVersion: "1.0",
    ruleset: "base_only_1v4_10.0.2",
    patch: "10.0.2",
    matchId: [
      "synthetic",
      input.averageChaseGapSeconds,
      input.firstChaseDurationSeconds,
      input.generatorsRemainingAtFirstElimination,
    ].join("-"),
    durationMs,
    survivors: [...SURVIVORS],
    generators: [...GENERATORS],
    unsupportedMechanics: [],
    events,
  };
}

export function generateSyntheticMatchLog(
  input: Readonly<SyntheticLogInput>,
): SyntheticLogResult {
  const inputIssues = validateSyntheticLogInput(input);

  if (inputIssues.length > 0) {
    return { ok: false, errors: inputIssues };
  }

  const log = buildLog(input);
  const source = JSON.stringify(log, null, 2);
  const validation = parseMatchLogJson(source);

  if (!validation.ok || validation.data === null) {
    return {
      ok: false,
      errors: [
        {
          field: "generator",
          code: "GENERATED_LOG_INVALID",
          message: `生成结果未通过日志校验：${validation.errors.map((issue) => issue.message).join("；")}`,
        },
      ],
    };
  }

  const metrics = calculateMatchMetrics(validation.data, DEFAULT_METRIC_CONFIG);
  const verification: SyntheticLogVerification = {
    averageChaseGapSeconds:
      (availableValue(metrics.engagement.averageChaseGap) ?? Number.NaN)
      / MILLISECONDS_PER_SECOND,
    firstChaseDurationSeconds:
      (availableValue(metrics.chase.firstChaseDuration) ?? Number.NaN)
      / MILLISECONDS_PER_SECOND,
    generatorsRemainingAtFirstElimination:
      availableValue(metrics.elimination.firstEliminationGeneratorsRemaining)
      ?? Number.NaN,
  };
  const matchesInput = (
    verification.averageChaseGapSeconds === input.averageChaseGapSeconds
    && verification.firstChaseDurationSeconds === input.firstChaseDurationSeconds
    && verification.generatorsRemainingAtFirstElimination
      === input.generatorsRemainingAtFirstElimination
  );

  if (!matchesInput) {
    return {
      ok: false,
      errors: [
        {
          field: "generator",
          code: "SELF_CHECK_FAILED",
          message: "生成日志的指标回算结果与输入不一致，已停止使用该结果。",
        },
      ],
    };
  }

  return { ok: true, log, source, verification };
}
