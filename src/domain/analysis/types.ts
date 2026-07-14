import type { MatchLog, ValidationIssue } from "../log";
import type { MatchMetrics, MetricUnit } from "../metrics";
import type { FeedbackRuleId, RuleEngineResult } from "../rules";
import type { TimelineItem } from "../timeline";

export type MetricGroupId = "finding" | "chase" | "generatorControl" | "hookYield";

export type DisplayMetricId =
  | "finding.firstFindTime"
  | "finding.averageSearchGap"
  | "finding.averagePostHookTargetAcquisition"
  | "chase.firstChaseToFirstDown"
  | "chase.firstChaseToFirstHook"
  | "chase.averageChaseDuration"
  | "chase.abandonedChaseCount"
  | "generatorControl.highProgressGeneratorLosses"
  | "generatorControl.keyGeneratorInterruptions"
  | "hookYield.totalHooks"
  | "hookYield.uniqueSurvivorsHooked"
  | "hookYield.secondHookConversions"
  | "hookYield.firstEliminationTime"
  | "hookYield.firstHookChainEliminationTime"
  | "hookYield.hookConcentration";

export interface MetricDisplayItem {
  id: DisplayMetricId;
  group: MetricGroupId;
  label: string;
  status: "available" | "unavailable";
  valueText: string;
  unit: MetricUnit;
  sampleSize: number;
  referenceText: string;
  explanation: string;
  unavailableReason: string | null;
  evidenceEventIds: string[];
}

export interface MetricDisplayGroup {
  id: MetricGroupId;
  title: string;
  items: MetricDisplayItem[];
}

export interface FeedbackDisplay {
  ruleId: FeedbackRuleId;
  title: string;
  dimensionLabel: string;
  message: string;
  practiceGoal: string;
  evidenceEventIds: string[];
  isNoClearBreakpoint: boolean;
}

export interface AnalysisPresentation {
  feedback: FeedbackDisplay;
  keyMetrics: MetricDisplayItem[];
  metricGroups: MetricDisplayGroup[];
}

export interface InvalidAnalysisResult {
  status: "invalid";
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface ReadyAnalysisResult {
  status: "ready";
  log: MatchLog;
  errors: [];
  warnings: ValidationIssue[];
  metrics: MatchMetrics;
  rules: RuleEngineResult;
  presentation: AnalysisPresentation;
  timeline: TimelineItem[];
}

export type AnalysisResult = InvalidAnalysisResult | ReadyAnalysisResult;
