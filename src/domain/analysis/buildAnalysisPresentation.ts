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
  finding: "找人效率",
  chase: "追击效率",
  generatorControl: "发电机控制",
  hookYield: "挂钩收益",
};

const dimensionCopy: Record<string, string> = {
  finding: "找人",
  chase: "追击",
  generator_control: "发电机控制",
  hook_yield: "挂钩收益",
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
  const value = milliseconds / 1000;
  return `${Number.isInteger(value) ? value : value.toFixed(1)} 秒`;
}

function percent(ratio: number): string {
  const value = ratio * 100;
  return `${Number.isInteger(value) ? value : value.toFixed(1)}%`;
}

function formatMetricValue(metric: NumericMetric): string {
  if (metric.status === "unavailable") {
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
  const searchGapThreshold = ruleConfig.rules.SEARCH_GAP_TOO_LONG.thresholdMs;
  const generatorLossThreshold = ruleConfig.rules.GENERATOR_CONTROL_WEAK.minimumLosses;
  const hookRule = ruleConfig.rules.HOOK_PRESSURE_DIFFUSE;
  const highProgressLabel = percent(metricConfig.highProgressThreshold);

  return [
    { id: "finding.firstFindTime", group: "finding", label: "首次确认目标", metric: metrics.finding.firstFindTime, referenceText: "未设置诊断阈值" },
    { id: "finding.averageSearchGap", group: "finding", label: "平均再搜寻空窗", metric: metrics.finding.averageSearchGap, referenceText: `参考：> ${seconds(searchGapThreshold)}` },
    { id: "finding.averagePostHookTargetAcquisition", group: "finding", label: "挂钩后平均接敌", metric: metrics.finding.averagePostHookTargetAcquisition, referenceText: "未设置诊断阈值" },
    { id: "chase.firstChaseToFirstDown", group: "chase", label: "首追至首次倒地", metric: metrics.chase.firstChaseToFirstDown, referenceText: "未设置诊断阈值" },
    { id: "chase.firstChaseToFirstHook", group: "chase", label: "首追至首次挂钩", metric: metrics.chase.firstChaseToFirstHook, referenceText: `参考：> ${seconds(firstChaseThreshold)}` },
    { id: "chase.averageChaseDuration", group: "chase", label: "完整追逐平均时长", metric: metrics.chase.averageChaseDuration, referenceText: "未设置诊断阈值" },
    { id: "chase.abandonedChaseCount", group: "chase", label: "放弃或转火追逐", metric: metrics.chase.abandonedChaseCount, referenceText: "未设置诊断阈值" },
    { id: "generatorControl.highProgressGeneratorLosses", group: "generatorControl", label: "高进度发电机丢失", metric: metrics.generatorControl.highProgressGeneratorLosses, referenceText: `参考：≥ ${generatorLossThreshold} 台（高进度 ${highProgressLabel}）` },
    { id: "generatorControl.keyGeneratorInterruptions", group: "generatorControl", label: "高进度有效干扰", metric: metrics.generatorControl.keyGeneratorInterruptions, referenceText: `高进度口径：≥ ${highProgressLabel}` },
    { id: "hookYield.totalHooks", group: "hookYield", label: "有效挂钩总数", metric: metrics.hookYield.totalHooks, referenceText: `规则最低样本：${hookRule.minimumTotalHooks} 次` },
    { id: "hookYield.uniqueSurvivorsHooked", group: "hookYield", label: "被挂钩逃生者数", metric: metrics.hookYield.uniqueSurvivorsHooked, referenceText: "未设置诊断阈值" },
    { id: "hookYield.secondHookConversions", group: "hookYield", label: "获救后再次上钩", metric: metrics.hookYield.secondHookConversions, referenceText: `规则参考：< ${hookRule.maximumSecondHookConversionsExclusive} 人` },
    { id: "hookYield.firstEliminationTime", group: "hookYield", label: "首次永久减员", metric: metrics.hookYield.firstEliminationTime, referenceText: `规则参考：> ${seconds(hookRule.lateEliminationThresholdMs)}` },
    { id: "hookYield.firstHookChainEliminationTime", group: "hookYield", label: "首次挂钩链减员", metric: metrics.hookYield.firstHookChainEliminationTime, referenceText: "未设置诊断阈值" },
    { id: "hookYield.hookConcentration", group: "hookYield", label: "挂钩集中度", metric: metrics.hookYield.hookConcentration, referenceText: "未设置诊断阈值" },
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
    ? ["chase.firstChaseToFirstHook", "finding.averageSearchGap", "generatorControl.highProgressGeneratorLosses"]
    : feedback.triggeredMetricIds;
  const keyMetrics = preferredMetricIds
    .map((id) => metricMap.get(id))
    .filter((metric): metric is MetricDisplayItem => metric !== undefined)
    .slice(0, ruleConfig.maxDisplayedMetrics);
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
