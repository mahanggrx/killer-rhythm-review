import type { MatchMetrics, MetricConfig, NumericMetric } from "../metrics";
import type { RuleEngineConfig, RuleEngineResult } from "../rules";
import type {
  AnalysisPresentation,
  DisplayMetricId,
  FeedbackDisplay,
  MetricDisplayGroup,
  MetricDisplayItem,
  MetricGroupId,
} from "./types";

const groupCopy: Record<MetricGroupId, string> = {
  engagement: "接敌节奏",
  chase: "追击效率",
  generatorControl: "发电机控制",
  elimination: "减员结果",
};

const dimensionCopy: Record<string, string> = {
  engagement: "接敌",
  chase: "追击",
  elimination: "减员结果",
  none: "证据不足",
};

interface MetricDefinition {
  id: DisplayMetricId;
  group: MetricGroupId;
  label: string;
  metric: NumericMetric;
  referenceText: string;
}

function seconds(milliseconds: number): string {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) return "不可用";
  const value = milliseconds / 1000;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} 秒`;
}

function percent(ratio: number): string {
  if (!Number.isFinite(ratio) || ratio < 0) return "不可用";
  const value = ratio * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatMetricValue(metric: NumericMetric): string {
  if (
    metric.status === "unavailable" ||
    !Number.isFinite(metric.value) ||
    metric.value < 0 ||
    (metric.unit === "ratio" && metric.value > 1)
  ) {
    return "不可用";
  }

  switch (metric.unit) {
    case "milliseconds":
      return seconds(metric.value);
    case "ratio":
      return percent(metric.value);
    case "count":
      return String(metric.value);
  }
}

function toDisplayItem(definition: MetricDefinition): MetricDisplayItem {
  const { metric } = definition;

  return {
    id: definition.id,
    group: definition.group,
    label: definition.label,
    status: metric.status,
    valueText: formatMetricValue(metric),
    unit: metric.unit,
    sampleSize: metric.sampleSize,
    referenceText: definition.referenceText,
    explanation: metric.explanation,
    unavailableReason: metric.status === "unavailable" ? metric.reason.message : null,
    evidenceEventIds: [...metric.evidenceEventIds],
  };
}

function createMetricDefinitions(
  metrics: MatchMetrics,
  metricConfig: Readonly<MetricConfig>,
  ruleConfig: Readonly<RuleEngineConfig>,
): MetricDefinition[] {
  const firstChaseThreshold = ruleConfig.rules.FIRST_CHASE_TOO_LONG.thresholdMs;
  const engagementRule = ruleConfig.rules.ENGAGEMENT_GAP_TOO_LONG;
  const eliminationRule = ruleConfig.rules.LATE_FIRST_ELIMINATION;
  const highProgressLabel = percent(metricConfig.highProgressThreshold);

  return [
    { id: "engagement.averageChaseGap", group: "engagement", label: "平均追逐空窗", metric: metrics.engagement.averageChaseGap, referenceText: `参考：> ${seconds(engagementRule.thresholdMs)}` },
    { id: "chase.firstChaseDuration", group: "chase", label: "首次追逐时长", metric: metrics.chase.firstChaseDuration, referenceText: `参考：> ${seconds(firstChaseThreshold)}` },
    { id: "chase.firstChaseToFirstDown", group: "chase", label: "首追至首次倒地", metric: metrics.chase.firstChaseToFirstDown, referenceText: "未设置诊断阈值" },
    { id: "chase.averageChaseDuration", group: "chase", label: "完整追逐平均时长", metric: metrics.chase.averageChaseDuration, referenceText: "未设置诊断阈值" },
    { id: "chase.abandonedChaseCount", group: "chase", label: "放弃或转火追逐", metric: metrics.chase.abandonedChaseCount, referenceText: "未设置诊断阈值" },
    { id: "generatorControl.highProgressGeneratorLosses", group: "generatorControl", label: "高进度发电机丢失", metric: metrics.generatorControl.highProgressGeneratorLosses, referenceText: `高进度口径：≥ ${highProgressLabel}` },
    { id: "generatorControl.keyGeneratorInterruptions", group: "generatorControl", label: "高进度有效干扰", metric: metrics.generatorControl.keyGeneratorInterruptions, referenceText: `高进度口径：≥ ${highProgressLabel}` },
    { id: "elimination.firstEliminationGeneratorsRemaining", group: "elimination", label: "首次减员时剩余修理目标", metric: metrics.elimination.firstEliminationGeneratorsRemaining, referenceText: `规则参考：≤ ${eliminationRule.maximumGeneratorsRemaining} 台` },
    { id: "elimination.totalEliminations", group: "elimination", label: "永久减员总数", metric: metrics.elimination.totalEliminations, referenceText: "献祭、处决和流血死亡" },
  ];
}

export function buildAnalysisPresentation(
  metrics: MatchMetrics,
  rules: RuleEngineResult,
  metricConfig: Readonly<MetricConfig>,
  ruleConfig: Readonly<RuleEngineConfig>,
): AnalysisPresentation {
  const allMetrics = createMetricDefinitions(metrics, metricConfig, ruleConfig).map(toDisplayItem);
  const metricMap = new Map(allMetrics.map((metric) => [metric.id, metric]));
  const feedback = rules.primaryFeedback;
  const preferredMetricIds: DisplayMetricId[] = feedback.ruleId === "no_clear_breakpoint"
    ? ["chase.firstChaseDuration", "engagement.averageChaseGap", "elimination.firstEliminationGeneratorsRemaining"]
    : feedback.triggeredMetricIds;
  const maxDisplayedMetrics = Number.isInteger(ruleConfig.maxDisplayedMetrics)
    ? Math.min(3, Math.max(1, ruleConfig.maxDisplayedMetrics))
    : 3;
  const keyMetrics = preferredMetricIds
    .map((id) => metricMap.get(id))
    .filter((metric): metric is MetricDisplayItem => metric !== undefined)
    .slice(0, maxDisplayedMetrics);
  const metricGroups: MetricDisplayGroup[] = (Object.keys(groupCopy) as MetricGroupId[]).map((group) => ({
    id: group,
    title: groupCopy[group],
    items: allMetrics.filter((metric) => metric.group === group),
  }));
  const feedbackDisplay: FeedbackDisplay = {
    ruleId: feedback.ruleId,
    title: feedback.title,
    dimensionLabel: dimensionCopy[feedback.dimension],
    message: feedback.message,
    practiceGoal: feedback.practiceGoal,
    evidenceEventIds: [...feedback.evidenceEventIds],
    isNoClearBreakpoint: feedback.ruleId === "no_clear_breakpoint",
  };

  return { feedback: feedbackDisplay, keyMetrics, metricGroups };
}
