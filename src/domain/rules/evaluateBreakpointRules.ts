import type {
  AvailableMetric,
  MatchMetrics,
  NumericMetric,
} from "../metrics";
import { DEFAULT_RULE_ENGINE_CONFIG, validateRuleEngineConfig } from "./config";
import { NO_CLEAR_BREAKPOINT_COPY, RULE_COPY } from "./ruleCopy";
import type {
  EvidenceOperator,
  NoClearBreakpointFeedback,
  RuleEngineConfig,
  RuleEngineDiagnostic,
  RuleEngineResult,
  RuleEvidence,
  RuleFeedback,
  RuleId,
  RuleSeverity,
  TriggeredMetricId,
} from "./types";

interface RankedCandidate {
  feedback: RuleFeedback;
  evidenceSufficiency: number;
  severityScore: number;
  relativeDeviation: number;
  confidence: number;
  priority: number;
}

function isAvailable(metric: NumericMetric): metric is AvailableMetric {
  return metric.status === "available"
    && Number.isFinite(metric.value)
    && metric.value >= 0
    && Number.isInteger(metric.sampleSize)
    && metric.sampleSize >= 0
    && Number.isFinite(metric.confidence)
    && metric.confidence >= 0
    && metric.confidence <= 1;
}

function evidenceSufficiency(sampleSize: number, minimumSampleSize: number): number {
  return sampleSize / (sampleSize + minimumSampleSize);
}

function noClearBreakpoint(): NoClearBreakpointFeedback {
  return {
    ruleId: "no_clear_breakpoint",
    title: NO_CLEAR_BREAKPOINT_COPY.title,
    dimension: "none",
    severity: "none",
    evidence: [],
    evidenceEventIds: [],
    message: NO_CLEAR_BREAKPOINT_COPY.message,
    practiceGoal: NO_CLEAR_BREAKPOINT_COPY.practiceGoal,
    triggeredMetricIds: [],
  };
}

function severityFromScore(
  score: number,
  config: RuleEngineConfig,
): Exclude<RuleSeverity, "none"> {
  if (score >= config.severityBands.criticalMinScore) return "critical";
  if (score >= config.severityBands.highMinScore) return "high";
  return "moderate";
}

function buildEvidence(
  metricId: TriggeredMetricId,
  metric: NumericMetric,
  operator: EvidenceOperator,
  threshold: number | null,
): RuleEvidence {
  return {
    metricId,
    status: metric.status,
    value: metric.value,
    unit: metric.unit,
    comparison: { operator, threshold },
    explanation: metric.explanation,
    evidenceEventIds: [...metric.evidenceEventIds],
    ...(metric.status === "unavailable"
      ? { unavailableReasonCode: metric.reason.code }
      : {}),
  };
}

function createCandidate(
  ruleId: RuleId,
  evidence: RuleEvidence[],
  relativeDeviation: number,
  evidenceSufficiencyScore: number,
  baseSeverity: number,
  deviationWeight: number,
  confidence: number,
  config: RuleEngineConfig,
  copyOverride?: Partial<Pick<RuleFeedback, "title" | "message" | "practiceGoal">>,
): RankedCandidate {
  const limitedEvidence = evidence.slice(0, config.maxDisplayedMetrics);
  const copy = RULE_COPY[ruleId];
  const severityScore = baseSeverity + relativeDeviation * deviationWeight;
  const priority = config.priority.indexOf(ruleId);

  return {
    feedback: {
      ruleId,
      title: copyOverride?.title ?? copy.title,
      dimension: copy.dimension,
      severity: severityFromScore(severityScore, config),
      evidence: limitedEvidence,
      evidenceEventIds: [
        ...new Set(limitedEvidence.flatMap((item) => item.evidenceEventIds)),
      ],
      message: copyOverride?.message ?? copy.message,
      practiceGoal: copyOverride?.practiceGoal ?? copy.practiceGoal,
      triggeredMetricIds: limitedEvidence.map((item) => item.metricId),
    },
    evidenceSufficiency: evidenceSufficiencyScore,
    severityScore,
    relativeDeviation,
    confidence,
    priority,
  };
}

function addUnavailableDiagnostic(
  diagnostics: RuleEngineDiagnostic[],
  ruleId: RuleId,
  metricId: TriggeredMetricId,
  metric: NumericMetric,
  minimumSampleSize?: number,
): void {
  const message = metric.status === "unavailable"
    ? `${metricId} 不可用：${metric.reason.message}`
    : `${metricId} 样本量 ${metric.sampleSize} 低于规则最低要求 ${minimumSampleSize ?? 0}。`;

  diagnostics.push({
    severity: "warning",
    code: "metric_unavailable",
    message,
    ruleId,
    metricIds: [metricId],
  });
}

function evaluateFirstChaseStartRule(
  metrics: MatchMetrics,
  config: RuleEngineConfig,
  diagnostics: RuleEngineDiagnostic[],
): RankedCandidate | null {
  const rule = config.rules.FIRST_CHASE_START_TOO_LATE;
  if (!rule.enabled) return null;

  const metric = metrics.engagement.firstChaseStartTime;
  const metricId = "engagement.firstChaseStartTime" as const;

  if (!isAvailable(metric) || metric.sampleSize < rule.minimumSampleSize) {
    addUnavailableDiagnostic(
      diagnostics,
      "FIRST_CHASE_START_TOO_LATE",
      metricId,
      metric,
      rule.minimumSampleSize,
    );
    return null;
  }

  if (metric.value <= rule.thresholdMs) return null;

  const relativeDeviation = (metric.value - rule.thresholdMs) / rule.thresholdMs;
  return createCandidate(
    "FIRST_CHASE_START_TOO_LATE",
    [buildEvidence(metricId, metric, ">", rule.thresholdMs)],
    relativeDeviation,
    evidenceSufficiency(metric.sampleSize, rule.minimumSampleSize),
    rule.baseSeverity,
    rule.deviationWeight,
    rule.confidence * metric.confidence,
    config,
  );
}

function evaluateAverageChaseRule(
  metrics: MatchMetrics,
  config: RuleEngineConfig,
  diagnostics: RuleEngineDiagnostic[],
): RankedCandidate | null {
  const rule = config.rules.AVERAGE_CHASE_TOO_LONG;
  if (!rule.enabled) return null;

  const metric = metrics.chase.averageChaseDuration;
  const metricId = "chase.averageChaseDuration" as const;

  if (!isAvailable(metric) || metric.sampleSize < rule.minimumSampleSize) {
    addUnavailableDiagnostic(
      diagnostics,
      "AVERAGE_CHASE_TOO_LONG",
      metricId,
      metric,
      rule.minimumSampleSize,
    );
    return null;
  }

  if (metric.value <= rule.thresholdMs) return null;

  const relativeDeviation = (metric.value - rule.thresholdMs) / rule.thresholdMs;

  return createCandidate(
    "AVERAGE_CHASE_TOO_LONG",
    [buildEvidence(metricId, metric, ">", rule.thresholdMs)],
    relativeDeviation,
    evidenceSufficiency(metric.sampleSize, rule.minimumSampleSize),
    rule.baseSeverity,
    rule.deviationWeight,
    rule.confidence * metric.confidence,
    config,
  );
}

function evaluateLateEliminationRule(
  metrics: MatchMetrics,
  config: RuleEngineConfig,
  diagnostics: RuleEngineDiagnostic[],
): RankedCandidate | null {
  const rule = config.rules.LATE_FIRST_ELIMINATION;
  if (!rule.enabled) return null;

  const firstElimination = metrics.elimination.firstEliminationGeneratorsRemaining;
  const totalEliminations = metrics.elimination.totalEliminations;
  const firstId = "elimination.firstEliminationGeneratorsRemaining" as const;
  const totalId = "elimination.totalEliminations" as const;

  if (isAvailable(firstElimination)) {
    if (
      firstElimination.sampleSize < rule.minimumSampleSize
      || firstElimination.value > rule.maximumGeneratorsRemaining
    ) {
      if (firstElimination.sampleSize < rule.minimumSampleSize) {
        addUnavailableDiagnostic(
          diagnostics,
          "LATE_FIRST_ELIMINATION",
          firstId,
          firstElimination,
          rule.minimumSampleSize,
        );
      }
      return null;
    }

    const relativeDeviation = (
      rule.maximumGeneratorsRemaining - firstElimination.value + 1
    ) / (rule.maximumGeneratorsRemaining + 1);

    return createCandidate(
      "LATE_FIRST_ELIMINATION",
      [buildEvidence(
        firstId,
        firstElimination,
        "<=",
        rule.maximumGeneratorsRemaining,
      )],
      relativeDeviation,
      evidenceSufficiency(firstElimination.sampleSize, rule.minimumSampleSize),
      rule.baseSeverity,
      rule.deviationWeight,
      rule.confidence * firstElimination.confidence,
      config,
      {
        message: `本局数据显示，首次永久减员形成时，基础修理目标只剩 ${firstElimination.value} 台。`,
      },
    );
  }

  const completedWithoutElimination = firstElimination.reason.code === "no_elimination_event"
    && isAvailable(totalEliminations)
    && totalEliminations.value === 0;

  if (!completedWithoutElimination) {
    addUnavailableDiagnostic(
      diagnostics,
      "LATE_FIRST_ELIMINATION",
      firstId,
      firstElimination,
      rule.minimumSampleSize,
    );
    return null;
  }

  return createCandidate(
    "LATE_FIRST_ELIMINATION",
    [buildEvidence(totalId, totalEliminations, "<", 1)],
    rule.noEliminationRelativeDeviation,
    evidenceSufficiency(totalEliminations.sampleSize, rule.minimumSampleSize),
    rule.baseSeverity,
    rule.deviationWeight,
    rule.confidence * totalEliminations.confidence,
    config,
    {
      title: "本局未形成永久减员",
      message: "本局日志正常结束，但没有记录到献祭、处决或流血死亡。该结论不把逃脱或 BOT 接管计为杀手减员。",
    },
  );
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  return right.evidenceSufficiency - left.evidenceSufficiency
    || right.relativeDeviation - left.relativeDeviation
    || right.confidence - left.confidence
    || left.priority - right.priority
    || (left.feedback.ruleId < right.feedback.ruleId
      ? -1
      : left.feedback.ruleId > right.feedback.ruleId
        ? 1
        : 0);
}

export function evaluateBreakpointRules(
  metrics: MatchMetrics,
  configInput: unknown = DEFAULT_RULE_ENGINE_CONFIG,
): RuleEngineResult {
  const validation = validateRuleEngineConfig(configInput);

  if (!validation.ok || validation.data === null) {
    return {
      primaryFeedback: noClearBreakpoint(),
      triggeredCandidates: [],
      diagnostics: validation.errors.map((message) => ({
        severity: "error" as const,
        code: "invalid_rule_config" as const,
        message,
        metricIds: [],
      })),
      prototypeThresholdNotice:
        "规则配置无效，未执行阈值判断；默认阈值均应标记为原型待验证数值。",
    };
  }

  const config = validation.data;
  const diagnostics: RuleEngineDiagnostic[] = [];
  const candidates = [
    evaluateFirstChaseStartRule(metrics, config, diagnostics),
    evaluateAverageChaseRule(metrics, config, diagnostics),
    evaluateLateEliminationRule(metrics, config, diagnostics),
  ].filter((candidate): candidate is RankedCandidate => candidate !== null);

  candidates.sort(compareCandidates);
  const triggeredCandidates = candidates.map((candidate) => candidate.feedback);

  return {
    primaryFeedback: triggeredCandidates[0] ?? noClearBreakpoint(),
    triggeredCandidates,
    diagnostics,
    prototypeThresholdNotice: config.prototypeThresholdNotice,
  };
}
