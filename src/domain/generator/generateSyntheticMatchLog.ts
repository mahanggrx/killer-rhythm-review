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
const BLEED_OUT_DURATION_MS = 240_000;
const DEFAULT_COMPLETE_CHASE_COUNT = 2;
const DEFAULT_SUBSEQUENT_CHASE_DURATION_SECONDS = 20;
const DEFAULT_ABANDONED_CHASE_COUNT = 1;
const HIGH_GENERATOR_PROGRESS = 0.9;
const LOW_GENERATOR_PROGRESS = 0.5;
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

interface NumericFieldRule {
  field: SyntheticLogInputField;
  label: string;
  minimum: number;
  maximum: number;
  required: boolean;
}

interface ResolvedSyntheticLogInput {
  averageChaseGapSeconds: number;
  firstChaseDurationSeconds: number;
  generatorsRemainingAtFirstElimination: number;
  completeChaseCount: number;
  chaseDurationsSeconds: number[];
  abandonedChaseCount: number;
  highProgressGeneratorLosses: number;
  keyGeneratorInterruptions: number;
  totalEliminations: number;
}

const NUMERIC_FIELD_RULES: readonly NumericFieldRule[] = [
  {
    field: "averageChaseGapSeconds",
    label: "平均追逐空窗",
    minimum: SYNTHETIC_LOG_LIMITS.minimumSeconds,
    maximum: SYNTHETIC_LOG_LIMITS.maximumSeconds,
    required: true,
  },
  {
    field: "firstChaseDurationSeconds",
    label: "首次追逐持续时间",
    minimum: SYNTHETIC_LOG_LIMITS.minimumFirstChaseSeconds,
    maximum: SYNTHETIC_LOG_LIMITS.maximumSeconds,
    required: true,
  },
  {
    field: "generatorsRemainingAtFirstElimination",
    label: "首次减员时剩余发电机",
    minimum: SYNTHETIC_LOG_LIMITS.minimumGeneratorsRemaining,
    maximum: SYNTHETIC_LOG_LIMITS.maximumGeneratorsRemaining,
    required: true,
  },
  {
    field: "completeChaseCount",
    label: "完整追逐次数",
    minimum: SYNTHETIC_LOG_LIMITS.minimumCompleteChases,
    maximum: SYNTHETIC_LOG_LIMITS.maximumCompleteChases,
    required: false,
  },
  {
    field: "averageChaseDurationSeconds",
    label: "平均追逐持续时间",
    minimum: SYNTHETIC_LOG_LIMITS.minimumAverageChaseSeconds,
    maximum: SYNTHETIC_LOG_LIMITS.maximumSeconds,
    required: false,
  },
  {
    field: "abandonedChaseCount",
    label: "目标丢失或转火次数",
    minimum: SYNTHETIC_LOG_LIMITS.minimumAbandonedChases,
    maximum: SYNTHETIC_LOG_LIMITS.maximumCompleteChases,
    required: false,
  },
  {
    field: "highProgressGeneratorLosses",
    label: "高进度发电机丢失数",
    minimum: 0,
    maximum: SYNTHETIC_LOG_LIMITS.maximumHighProgressGeneratorLosses,
    required: false,
  },
  {
    field: "keyGeneratorInterruptions",
    label: "高进度有效干扰次数",
    minimum: 0,
    maximum: SYNTHETIC_LOG_LIMITS.maximumKeyGeneratorInterruptions,
    required: false,
  },
  {
    field: "totalEliminations",
    label: "最终永久减员数",
    minimum: SYNTHETIC_LOG_LIMITS.minimumEliminations,
    maximum: SYNTHETIC_LOG_LIMITS.maximumEliminations,
    required: false,
  },
] as const;

function validIntegerInRange(
  value: number | undefined,
  minimum: number,
  maximum: number,
): value is number {
  return (
    value !== undefined
    && Number.isFinite(value)
    && Number.isInteger(value)
    && value >= minimum
    && value <= maximum
  );
}

export function validateSyntheticLogInput(
  input: Readonly<SyntheticLogInput>,
): SyntheticLogInputIssue[] {
  const issues: SyntheticLogInputIssue[] = [];

  for (const rule of NUMERIC_FIELD_RULES) {
    const value = input[rule.field];

    if (value === undefined && !rule.required) {
      continue;
    }

    if (value === undefined || !Number.isFinite(value)) {
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

  const completeChaseCount = input.completeChaseCount
    ?? DEFAULT_COMPLETE_CHASE_COUNT;
  const completeChaseCountIsValid = validIntegerInRange(
    completeChaseCount,
    SYNTHETIC_LOG_LIMITS.minimumCompleteChases,
    SYNTHETIC_LOG_LIMITS.maximumCompleteChases,
  );

  if (
    completeChaseCountIsValid
    && validIntegerInRange(
      input.abandonedChaseCount,
      SYNTHETIC_LOG_LIMITS.minimumAbandonedChases,
      SYNTHETIC_LOG_LIMITS.maximumCompleteChases,
    )
    && input.abandonedChaseCount > completeChaseCount
  ) {
    issues.push({
      field: "abandonedChaseCount",
      code: "INCONSISTENT_INPUT",
      message: "目标丢失或转火次数不能超过完整追逐次数。",
    });
  }

  if (
    completeChaseCountIsValid
    && validIntegerInRange(
      input.firstChaseDurationSeconds,
      SYNTHETIC_LOG_LIMITS.minimumFirstChaseSeconds,
      SYNTHETIC_LOG_LIMITS.maximumSeconds,
    )
    && validIntegerInRange(
      input.averageChaseDurationSeconds,
      SYNTHETIC_LOG_LIMITS.minimumAverageChaseSeconds,
      SYNTHETIC_LOG_LIMITS.maximumSeconds,
    )
  ) {
    const remainingDuration =
      input.averageChaseDurationSeconds * completeChaseCount
      - input.firstChaseDurationSeconds;
    const remainingChaseCount = completeChaseCount - 1;
    const minimumRemainingDuration =
      remainingChaseCount * SYNTHETIC_LOG_LIMITS.minimumAverageChaseSeconds;
    const maximumRemainingDuration =
      remainingChaseCount * SYNTHETIC_LOG_LIMITS.maximumSeconds;

    if (
      remainingDuration < minimumRemainingDuration
      || remainingDuration > maximumRemainingDuration
    ) {
      issues.push({
        field: "averageChaseDurationSeconds",
        code: "INCONSISTENT_INPUT",
        message: completeChaseCount === 1
          ? "只有一次完整追逐时，平均追逐持续时间必须等于首次追逐持续时间。"
          : "当前首次追逐时长、平均追逐时长和完整追逐次数无法组成有效的追逐区间。",
      });
    }
  }

  return issues;
}

function resolveChaseDurations(
  input: Readonly<SyntheticLogInput>,
  completeChaseCount: number,
): number[] {
  if (input.averageChaseDurationSeconds === undefined) {
    return [
      input.firstChaseDurationSeconds,
      ...Array.from(
        { length: completeChaseCount - 1 },
        () => DEFAULT_SUBSEQUENT_CHASE_DURATION_SECONDS,
      ),
    ];
  }

  const remainingChaseCount = completeChaseCount - 1;

  if (remainingChaseCount === 0) {
    return [input.firstChaseDurationSeconds];
  }

  const remainingDuration =
    input.averageChaseDurationSeconds * completeChaseCount
    - input.firstChaseDurationSeconds;
  const baseDuration = Math.floor(remainingDuration / remainingChaseCount);
  const remainder = remainingDuration % remainingChaseCount;

  return [
    input.firstChaseDurationSeconds,
    ...Array.from(
      { length: remainingChaseCount },
      (_, index) => baseDuration + (index < remainder ? 1 : 0),
    ),
  ];
}

function resolveInput(
  input: Readonly<SyntheticLogInput>,
): ResolvedSyntheticLogInput {
  const completeChaseCount = input.completeChaseCount
    ?? DEFAULT_COMPLETE_CHASE_COUNT;
  const completedBeforeFirstElimination =
    SYNTHETIC_LOG_LIMITS.maximumGeneratorsRemaining
    - input.generatorsRemainingAtFirstElimination;

  return {
    averageChaseGapSeconds: input.averageChaseGapSeconds,
    firstChaseDurationSeconds: input.firstChaseDurationSeconds,
    generatorsRemainingAtFirstElimination:
      input.generatorsRemainingAtFirstElimination,
    completeChaseCount,
    chaseDurationsSeconds: resolveChaseDurations(input, completeChaseCount),
    abandonedChaseCount: input.abandonedChaseCount
      ?? Math.min(DEFAULT_ABANDONED_CHASE_COUNT, completeChaseCount - 1),
    highProgressGeneratorLosses: input.highProgressGeneratorLosses
      ?? completedBeforeFirstElimination,
    keyGeneratorInterruptions: input.keyGeneratorInterruptions ?? 0,
    totalEliminations: input.totalEliminations ?? 1,
  };
}

function availableValue(metric: NumericMetric): number | null {
  return metric.status === "available" ? metric.value : null;
}

function buildLog(input: Readonly<ResolvedSyntheticLogInput>): MatchLog {
  const events: MatchEvent[] = [];
  const averageGapMs = input.averageChaseGapSeconds * MILLISECONDS_PER_SECOND;
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

  let chaseStartMs = averageGapMs;
  let lastChaseEndMs = 0;
  let firstEliminationDownMs: number | null = null;

  for (let index = 0; index < input.completeChaseCount; index += 1) {
    const chaseId = `chase-${index + 1}`;
    const survivorId = SURVIVORS[index % SURVIVORS.length];
    const chaseEndMs = chaseStartMs
      + input.chaseDurationsSeconds[index] * MILLISECONDS_PER_SECOND;
    const abandoned = index >= input.completeChaseCount - input.abandonedChaseCount;
    const formsFirstDown = index === 0 && !abandoned;

    events.push({
      ...nextBase(chaseStartMs, "chase_start"),
      chaseId,
      survivorId,
      source: "game_state",
    });

    if (formsFirstDown) {
      events.push({
        ...nextBase(
          chaseStartMs + Math.floor((chaseEndMs - chaseStartMs) / 2),
          "survivor_injured",
        ),
        survivorId,
        fromState: "healthy",
        cause: "basic_attack",
        sourceId: "killer",
      });
      events.push({
        ...nextBase(chaseEndMs, "survivor_downed"),
        survivorId,
        fromState: "injured",
        cause: "basic_attack",
        attribution: "killer",
        sourceId: "killer",
      });
      firstEliminationDownMs = chaseEndMs;
    }

    events.push({
      ...nextBase(chaseEndMs, "chase_end"),
      chaseId,
      survivorId,
      endReason: abandoned
        ? "target_switch"
        : formsFirstDown
          ? "target_downed"
          : "unknown",
      censored: false,
      policyGenerated: false,
    });

    lastChaseEndMs = chaseEndMs;
    chaseStartMs = chaseEndMs + averageGapMs;
  }

  let cursorMs = lastChaseEndMs;

  if (firstEliminationDownMs === null) {
    cursorMs += 2_000;
    events.push({
      ...nextBase(cursorMs, "survivor_injured"),
      survivorId: SURVIVORS[0],
      fromState: "healthy",
      cause: "basic_attack",
      sourceId: "killer",
    });
    cursorMs += 1_000;
    events.push({
      ...nextBase(cursorMs, "survivor_downed"),
      survivorId: SURVIVORS[0],
      fromState: "injured",
      cause: "basic_attack",
      attribution: "killer",
      sourceId: "killer",
    });
    firstEliminationDownMs = cursorMs;
  }

  for (let index = 0; index < input.keyGeneratorInterruptions; index += 1) {
    cursorMs += 4_000;
    events.push({
      ...nextBase(cursorMs, "generator_repair_stopped"),
      generatorId: GENERATORS[6],
      survivorId: SURVIVORS[1],
      progress: HIGH_GENERATOR_PROGRESS,
      reason: "forced_off",
    });
    cursorMs += 100;
    events.push({
      ...nextBase(cursorMs, "generator_progress_delta"),
      generatorId: GENERATORS[6],
      delta: -0.05,
      progressBefore: HIGH_GENERATOR_PROGRESS,
      progressAfter: HIGH_GENERATOR_PROGRESS - 0.05,
      cause: "synthetic_killer_interference",
      sourceId: "killer",
      applied: true,
      killerCaused: true,
      interferenceId: `interference-${index + 1}`,
    });
  }

  const completedBeforeFirstElimination =
    SYNTHETIC_LOG_LIMITS.maximumGeneratorsRemaining
    - input.generatorsRemainingAtFirstElimination;
  const totalCompletedGenerators = Math.max(
    completedBeforeFirstElimination,
    input.highProgressGeneratorLosses,
  );

  if (
    totalCompletedGenerators === 0
    && input.keyGeneratorInterruptions === 0
  ) {
    cursorMs += 4_000;
    events.push({
      ...nextBase(cursorMs, "generator_repair_stopped"),
      generatorId: GENERATORS[6],
      survivorId: SURVIVORS[1],
      progress: LOW_GENERATOR_PROGRESS,
      reason: "voluntary",
    });
  }

  const addGeneratorCompletion = (index: number): void => {
    const generatorId = GENERATORS[index];
    const isHighProgressLoss = index < input.highProgressGeneratorLosses;
    const progress = isHighProgressLoss
      ? HIGH_GENERATOR_PROGRESS
      : LOW_GENERATOR_PROGRESS;

    cursorMs += 4_000;
    events.push({
      ...nextBase(cursorMs, "generator_repair_stopped"),
      generatorId,
      survivorId: SURVIVORS[1],
      progress,
      reason: "voluntary",
    });
    cursorMs += 2_000;
    events.push({
      ...nextBase(cursorMs, "generator_completed"),
      generatorId,
      completionIndex: index + 1,
      progress: 1,
      contributors: [SURVIVORS[1]],
    });
  };

  for (let index = 0; index < completedBeforeFirstElimination; index += 1) {
    addGeneratorCompletion(index);
  }

  const firstEliminationMs = Math.max(
    cursorMs + 10_000,
    firstEliminationDownMs + BLEED_OUT_DURATION_MS,
  );
  cursorMs = firstEliminationMs;
  events.push({
    ...nextBase(cursorMs, "survivor_outcome"),
    survivorId: SURVIVORS[0],
    outcomeType: "bled_out",
    cause: "bleedout_timer",
    attribution: "killer",
  });

  for (
    let index = completedBeforeFirstElimination;
    index < totalCompletedGenerators;
    index += 1
  ) {
    addGeneratorCompletion(index);
  }

  const additionalDownTimes: number[] = [];

  for (let index = 1; index < input.totalEliminations; index += 1) {
    cursorMs += 2_000;
    events.push({
      ...nextBase(cursorMs, "survivor_injured"),
      survivorId: SURVIVORS[index],
      fromState: "healthy",
      cause: "basic_attack",
      sourceId: "killer",
    });
    cursorMs += 1_000;
    events.push({
      ...nextBase(cursorMs, "survivor_downed"),
      survivorId: SURVIVORS[index],
      fromState: "injured",
      cause: "basic_attack",
      attribution: "killer",
      sourceId: "killer",
    });
    additionalDownTimes.push(cursorMs);
  }

  for (let index = 1; index < input.totalEliminations; index += 1) {
    cursorMs = Math.max(
      cursorMs + 5_000,
      additionalDownTimes[index - 1] + BLEED_OUT_DURATION_MS,
    );
    events.push({
      ...nextBase(cursorMs, "survivor_outcome"),
      survivorId: SURVIVORS[index],
      outcomeType: "bled_out",
      cause: "bleedout_timer",
      attribution: "killer",
    });
  }

  const durationMs = cursorMs + 60_000;
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
      `c${input.completeChaseCount}`,
      `d${input.chaseDurationsSeconds.join("_")}`,
      `a${input.abandonedChaseCount}`,
      `l${input.highProgressGeneratorLosses}`,
      `i${input.keyGeneratorInterruptions}`,
      `e${input.totalEliminations}`,
    ].join("-"),
    durationMs,
    survivors: [...SURVIVORS],
    generators: [...GENERATORS],
    unsupportedMechanics: [],
    events,
  };
}

function secondsValue(metric: NumericMetric): number {
  return (availableValue(metric) ?? Number.NaN) / MILLISECONDS_PER_SECOND;
}

function countValue(metric: NumericMetric): number {
  return availableValue(metric) ?? Number.NaN;
}

function matchesOptionalInput(
  inputValue: number | undefined,
  verificationValue: number,
): boolean {
  return inputValue === undefined || inputValue === verificationValue;
}

export function generateSyntheticMatchLog(
  input: Readonly<SyntheticLogInput>,
): SyntheticLogResult {
  const inputIssues = validateSyntheticLogInput(input);

  if (inputIssues.length > 0) {
    return { ok: false, errors: inputIssues };
  }

  const resolvedInput = resolveInput(input);
  const log = buildLog(resolvedInput);
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
  const averageChaseDuration = metrics.chase.averageChaseDuration;
  const verification: SyntheticLogVerification = {
    averageChaseGapSeconds: secondsValue(metrics.engagement.averageChaseGap),
    firstChaseDurationSeconds: secondsValue(metrics.chase.firstChaseDuration),
    generatorsRemainingAtFirstElimination: countValue(
      metrics.elimination.firstEliminationGeneratorsRemaining,
    ),
    completeChaseCount: averageChaseDuration.status === "available"
      ? averageChaseDuration.sampleSize
      : Number.NaN,
    averageChaseDurationSeconds: secondsValue(averageChaseDuration),
    abandonedChaseCount: countValue(metrics.chase.abandonedChaseCount),
    highProgressGeneratorLosses: countValue(
      metrics.generatorControl.highProgressGeneratorLosses,
    ),
    keyGeneratorInterruptions: countValue(
      metrics.generatorControl.keyGeneratorInterruptions,
    ),
    totalEliminations: countValue(metrics.elimination.totalEliminations),
  };
  const matchesInput = (
    verification.averageChaseGapSeconds === input.averageChaseGapSeconds
    && verification.firstChaseDurationSeconds === input.firstChaseDurationSeconds
    && verification.generatorsRemainingAtFirstElimination
      === input.generatorsRemainingAtFirstElimination
    && matchesOptionalInput(
      input.completeChaseCount,
      verification.completeChaseCount,
    )
    && matchesOptionalInput(
      input.averageChaseDurationSeconds,
      verification.averageChaseDurationSeconds,
    )
    && matchesOptionalInput(
      input.abandonedChaseCount,
      verification.abandonedChaseCount,
    )
    && matchesOptionalInput(
      input.highProgressGeneratorLosses,
      verification.highProgressGeneratorLosses,
    )
    && matchesOptionalInput(
      input.keyGeneratorInterruptions,
      verification.keyGeneratorInterruptions,
    )
    && matchesOptionalInput(
      input.totalEliminations,
      verification.totalEliminations,
    )
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
