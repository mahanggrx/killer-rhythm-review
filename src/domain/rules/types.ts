import type { MetricUnit, NumericMetric } from "../metrics";

export const RULE_IDS = [
  "FIRST_CHASE_TOO_LONG",
  "SEARCH_GAP_TOO_LONG",
  "GENERATOR_CONTROL_WEAK",
  "HOOK_PRESSURE_DIFFUSE",
] as const;

export type RuleId = (typeof RULE_IDS)[number];
export type FeedbackRuleId = RuleId | "no_clear_breakpoint";
export type PlayerExperience = "novice" | "intermediate";
export type BreakpointDimension =
  | "finding"
  | "chase"
  | "generator_control"
  | "hook_yield"
  | "none";
export type RuleSeverity = "moderate" | "high" | "critical" | "none";

export type TriggeredMetricId =
  | "chase.firstChaseToFirstHook"
  | "finding.averageSearchGap"
  | "generatorControl.highProgressGeneratorLosses"
  | "hookYield.totalHooks"
  | "hookYield.secondHookConversions"
  | "hookYield.firstHookChainEliminationTime";

export type EvidenceOperator = ">" | ">=" | "<" | "unavailable";

export interface RuleEvidence {
  metricId: TriggeredMetricId;
  status: NumericMetric["status"];
  value: number | null;
  unit: MetricUnit;
  comparison: {
    operator: EvidenceOperator;
    threshold: number | null;
  };
  explanation: string;
  evidenceEventIds: string[];
  unavailableReasonCode?: string;
}

export interface RuleFeedback {
  ruleId: RuleId;
  title: string;
  dimension: Exclude<BreakpointDimension, "none">;
  severity: Exclude<RuleSeverity, "none">;
  evidence: RuleEvidence[];
  evidenceEventIds: string[];
  message: string;
  practiceGoal: string;
  triggeredMetricIds: TriggeredMetricId[];
}

export interface NoClearBreakpointFeedback {
  ruleId: "no_clear_breakpoint";
  title: string;
  dimension: "none";
  severity: "none";
  evidence: [];
  evidenceEventIds: [];
  message: string;
  practiceGoal: string;
  triggeredMetricIds: [];
}

export type PrimaryFeedback = RuleFeedback | NoClearBreakpointFeedback;

export interface RuleEngineDiagnostic {
  severity: "error" | "warning";
  code: "invalid_rule_config" | "metric_unavailable";
  message: string;
  ruleId?: RuleId;
  metricIds: TriggeredMetricId[];
}

export interface RuleEngineResult {
  primaryFeedback: PrimaryFeedback;
  triggeredCandidates: RuleFeedback[];
  diagnostics: RuleEngineDiagnostic[];
  prototypeThresholdNotice: string;
}

interface SeverityConfig {
  baseSeverity: number;
  deviationWeight: number;
  confidence: number;
}

export interface SingleMetricRuleConfig extends SeverityConfig {
  enabled: boolean;
  thresholdMs: number;
  minimumSampleSize: number;
}

export interface GeneratorRuleConfig extends SeverityConfig {
  enabled: boolean;
  minimumLosses: number;
  minimumSampleSize: number;
}

export interface HookPressureRuleConfig extends SeverityConfig {
  enabled: boolean;
  minimumTotalHooks: number;
  maximumSecondHookConversionsExclusive: number;
  minimumConversionOpportunities: number;
  lateEliminationThresholdMs: number;
  noEliminationRelativeDeviation: number;
}

export interface RuleEngineConfig {
  version: string;
  ruleset: "base_only_1v4_10.0.2";
  prototypeThresholdNotice: string;
  maxDisplayedMetrics: number;
  severityBands: {
    highMinScore: number;
    criticalMinScore: number;
  };
  priorityByExperience: Record<PlayerExperience, RuleId[]>;
  rules: {
    FIRST_CHASE_TOO_LONG: SingleMetricRuleConfig;
    SEARCH_GAP_TOO_LONG: SingleMetricRuleConfig;
    GENERATOR_CONTROL_WEAK: GeneratorRuleConfig;
    HOOK_PRESSURE_DIFFUSE: HookPressureRuleConfig;
  };
}

export interface RuleEvaluationContext {
  playerExperience: PlayerExperience;
}

export interface RuleConfigValidationResult {
  ok: boolean;
  data: RuleEngineConfig | null;
  errors: string[];
}
