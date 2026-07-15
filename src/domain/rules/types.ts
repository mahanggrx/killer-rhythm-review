import type { MetricUnit, NumericMetric } from "../metrics";

export const RULE_IDS = [
  "FIRST_CHASE_TOO_LONG",
  "LATE_FIRST_ELIMINATION",
  "ENGAGEMENT_GAP_TOO_LONG",
] as const;

export type RuleId = (typeof RULE_IDS)[number];
export type FeedbackRuleId = RuleId | "no_clear_breakpoint";
export type BreakpointDimension =
  | "engagement"
  | "chase"
  | "elimination"
  | "none";
export type RuleSeverity = "moderate" | "high" | "critical" | "none";

export type TriggeredMetricId =
  | "chase.firstChaseDuration"
  | "engagement.averageChaseGap"
  | "elimination.firstEliminationGeneratorsRemaining"
  | "elimination.totalEliminations";

export type EvidenceOperator = ">" | ">=" | "<" | "<=" | "unavailable";

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

export interface EliminationRuleConfig extends SeverityConfig {
  enabled: boolean;
  maximumGeneratorsRemaining: number;
  minimumSampleSize: number;
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
  priority: RuleId[];
  rules: {
    FIRST_CHASE_TOO_LONG: SingleMetricRuleConfig;
    LATE_FIRST_ELIMINATION: EliminationRuleConfig;
    ENGAGEMENT_GAP_TOO_LONG: SingleMetricRuleConfig;
  };
}

export interface RuleConfigValidationResult {
  ok: boolean;
  data: RuleEngineConfig | null;
  errors: string[];
}
