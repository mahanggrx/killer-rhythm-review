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
  RuleEvaluationContext,
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
  return metric.status === "available";
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
  if (score >= config.severityBands.criticalMinScore) {
    return "critical";
  }

  if (score >= config.severityBands.highMinScore) {
    return "high";
  }

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
  evidenceSufficiency: number,
  baseSeverity: number,
  deviationWeight: number,
  confidence: number,
  context: RuleEvaluationContext,
  config: RuleEngineConfig,
): RankedCandidate {
  const limitedEvidence = evidence.slice(0, config.maxDisplayedMetrics);
  const copy = RULE_COPY[ruleId];
  const severityScore = baseSeverity + relativeDeviation * deviationWeight;
  const priority = config.priorityByExperience[
    context.playerExperience
  ].indexOf(ruleId);

  return {
    feedback: {
      ruleId,
      title: copy.title,
      dimension: copy.dimension,
      severity: severityFromScore(severityScore, config),
      evidence: limitedEvidence,
      evidenceEventIds: [
        ...new Set(
          limitedEvidence.flatMap((item) => item.evidenceEventIds),
        ),
      ],
      message: copy.message,
      practiceGoal: copy.practiceGoal,
      triggeredMetricIds: limitedEvidence.map((item) => item.metricId),
    },
    evidenceSufficiency,
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
  const message =
    metric.status === "unavailable"
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

function evaluateFirstChaseRule(
  metrics: MatchMetrics,
  context: RuleEvaluationContext,
  config: RuleEngineConfig,
  diagnostics: RuleEngineDiagnostic[],
): RankedCandidate | null {
  const rule = config.rules.FIRST_CHASE_TOO_LONG;

  if (!rule.enabled) {
    return null;
  }

  const metric = metrics.chase.firstChaseToFirstHook;
  const metricId = "chase.firstChaseToFirstHook" as const;

  if (!isAvailable(metric) || metric.sampleSize < rule.minimumSampleSize) {
    addUnavailableDiagnostic(
      diagnostics,
      "FIRST_CHASE_TOO_LONG",
      metricId,
      metric,
      rule.minimumSampleSize,
    );
    return null;
  }

  if (metric.value <= rule.thresholdMs) {
    return null;
  }

  const relativeDeviation =
    (metric.value - rule.thresholdMs) / rule.thresholdMs;

  return createCandidate(
    "FIRST_CHASE_TOO_LONG",
    [buildEvidence(metricId, metric, ">", rule.thresholdMs)],
    relativeDeviation,
    Math.min(1, metric.sampleSize / rule.minimumSampleSize),
    rule.baseSeverity,
    rule.deviationWeight,
    rule.confidence,
    context,
    config,
  );
}

function evaluateSearchGapRule(
  metrics: MatchMetrics,
  context: RuleEvaluationContext,
  config: RuleEngineConfig,
  diagnostics: RuleEngineDiagnostic[],
): RankedCandidate | null {
  const rule = config.rules.SEARCH_GAP_TOO_LONG;

  if (!rule.enabled) {
    return null;
  }

  const metric = metrics.finding.averageSearchGap;
  const metricId = "finding.averageSearchGap" as const;

  if (!isAvailable(metric) || metric.sampleSize < rule.minimumSampleSize) {
    addUnavailableDiagnostic(
      diagnostics,
      "SEARCH_GAP_TOO_LONG",
      metricId,
      metric,
      rule.minimumSampleSize,
    );
    return null;
  }

  if (metric.value <= rule.thresholdMs) {
    return null;
  }

  const relativeDeviation =
    (metric.value - rule.thresholdMs) / rule.thresholdMs;

  return createCandidate(
    "SEARCH_GAP_TOO_LONG",
    [buildEvidence(metricId, metric, ">", rule.thresholdMs)],
    relativeDeviation,
    Math.min(1, metric.sampleSize / rule.minimumSampleSize),
    rule.baseSeverity,
    rule.deviationWeight,
    rule.confidence,
    context,
    config,
  );
}

function evaluateGeneratorRule(
  metrics: MatchMetrics,
  context: RuleEvaluationContext,
  config: RuleEngineConfig,
  diagnostics: RuleEngineDiagnostic[],
): RankedCandidate | null {
  const rule = config.rules.GENERATOR_CONTROL_WEAK;

  if (!rule.enabled) {
    return null;
  }

  const metric = metrics.generatorControl.highProgressGeneratorLosses;
  const metricId =
    "generatorControl.highProgressGeneratorLosses" as const;

  if (!isAvailable(metric) || metric.sampleSize < rule.minimumSampleSize) {
    addUnavailableDiagnostic(
      diagnostics,
      "GENERATOR_CONTROL_WEAK",
      metricId,
      metric,
      rule.minimumSampleSize,
    );
    return null;
  }

  if (metric.value < rule.minimumLosses) {
    return null;
  }

  const relativeDeviation =
    (metric.value - rule.minimumLosses) / rule.minimumLosses;

  return createCandidate(
    "GENERATOR_CONTROL_WEAK",
    [buildEvidence(metricId, metric, ">=", rule.minimumLosses)],
    relativeDeviation,
    Math.min(1, metric.sampleSize / rule.minimumSampleSize),
    rule.baseSeverity,
    rule.deviationWeight,
    rule.confidence,
    context,
    config,
  );
}

function evaluateHookPressureRule(
  metrics: MatchMetrics,
  context: RuleEvaluationContext,
  config: RuleEngineConfig,
  diagnostics: RuleEngineDiagnostic[],
): RankedCandidate | null {
  const rule = config.rules.HOOK_PRESSURE_DIFFUSE;

  if (!rule.enabled) {
    return null;
  }

  const totalHooks = metrics.hookYield.totalHooks;
  const conversions = metrics.hookYield.secondHookConversions;
  const elimination = metrics.hookYield.firstEliminationTime;
  const totalHooksId = "hookYield.totalHooks" as const;
  const conversionsId = "hookYield.secondHookConversions" as const;
  const eliminationId = "hookYield.firstEliminationTime" as const;

  if (!isAvailable(totalHooks)) {
    addUnavailableDiagnostic(
      diagnostics,
      "HOOK_PRESSURE_DIFFUSE",
      totalHooksId,
      totalHooks,
    );
    return null;
  }

  if (totalHooks.value < rule.minimumTotalHooks) {
    return null;
  }

  if (
    !isAvailable(conversions) ||
    conversions.sampleSize < rule.minimumConversionOpportunities
  ) {
    addUnavailableDiagnostic(
      diagnostics,
      "HOOK_PRESSURE_DIFFUSE",
      conversionsId,
      conversions,
      rule.minimumConversionOpportunities,
    );
    return null;
  }

  if (conversions.value >= rule.maximumSecondHookConversionsExclusive) {
    return null;
  }

  const noElimination =
    elimination.status === "unavailable" &&
    elimination.reason.code === "no_elimination_event";
  const lateElimination =
    isAvailable(elimination) &&
    elimination.value > rule.lateEliminationThresholdMs;

  if (!noElimination && !lateElimination) {
    if (!isAvailable(elimination)) {
      addUnavailableDiagnostic(
        diagnostics,
        "HOOK_PRESSURE_DIFFUSE",
        eliminationId,
        elimination,
      );
    }
    return null;
  }

  const conversionDeviation =
    (rule.maximumSecondHookConversionsExclusive - conversions.value) /
    rule.maximumSecondHookConversionsExclusive;
  const eliminationDeviation = noElimination
    ? rule.noEliminationRelativeDeviation
    : isAvailable(elimination)
      ? (elimination.value - rule.lateEliminationThresholdMs) /
        rule.lateEliminationThresholdMs
      : 0;
  const relativeDeviation = Math.max(
    conversionDeviation,
    eliminationDeviation,
  );
  const evidence: RuleEvidence[] = [
    buildEvidence(totalHooksId, totalHooks, ">=", rule.minimumTotalHooks),
    buildEvidence(
      conversionsId,
      conversions,
      "<",
      rule.maximumSecondHookConversionsExclusive,
    ),
    buildEvidence(
      eliminationId,
      elimination,
      noElimination ? "unavailable" : ">",
      noElimination ? null : rule.lateEliminationThresholdMs,
    ),
  ];

  return createCandidate(
    "HOOK_PRESSURE_DIFFUSE",
    evidence,
    relativeDeviation,
    Math.min(
      1,
      totalHooks.value / rule.minimumTotalHooks,
      conversions.sampleSize / rule.minimumConversionOpportunities,
    ),
    rule.baseSeverity,
    rule.deviationWeight,
    rule.confidence,
    context,
    config,
  );
}

function compareCandidates(
  left: RankedCandidate,
  right: RankedCandidate,
): number {
  return (
    right.evidenceSufficiency - left.evidenceSufficiency ||
    right.severityScore - left.severityScore ||
    right.relativeDeviation - left.relativeDeviation ||
    right.confidence - left.confidence ||
    left.priority - right.priority ||
    (left.feedback.ruleId < right.feedback.ruleId
      ? -1
      : left.feedback.ruleId > right.feedback.ruleId
        ? 1
        : 0)
  );
}

export function evaluateBreakpointRules(
  metrics: MatchMetrics,
  context: RuleEvaluationContext,
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
    evaluateFirstChaseRule(metrics, context, config, diagnostics),
    evaluateSearchGapRule(metrics, context, config, diagnostics),
    evaluateGeneratorRule(metrics, context, config, diagnostics),
    evaluateHookPressureRule(metrics, context, config, diagnostics),
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
