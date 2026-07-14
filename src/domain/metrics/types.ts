import type { EventId } from "../log";

export type MetricUnit = "milliseconds" | "count" | "ratio";

export type MetricUnavailableReasonCode =
  | "missing_trial_start"
  | "missing_target_acquired"
  | "insufficient_search_gap_samples"
  | "insufficient_post_hook_samples"
  | "missing_chase_start"
  | "missing_first_down"
  | "missing_first_hook"
  | "no_complete_chases"
  | "no_generator_progress_evidence"
  | "invalid_high_progress_threshold"
  | "no_elimination_event"
  | "no_hook_chain_elimination"
  | "no_hooks_for_concentration"
  | "non_finite_result";

export interface MetricUnavailableReason {
  code: MetricUnavailableReasonCode;
  message: string;
}

export interface AvailableMetric {
  status: "available";
  value: number;
  unit: MetricUnit;
  explanation: string;
  evidenceEventIds: EventId[];
  sampleSize: number;
}

export interface UnavailableMetric {
  status: "unavailable";
  value: null;
  unit: MetricUnit;
  explanation: string;
  evidenceEventIds: EventId[];
  sampleSize: 0;
  reason: MetricUnavailableReason;
}

export type NumericMetric = AvailableMetric | UnavailableMetric;

export interface MetricConfig {
  highProgressThreshold: number;
}

export type MetricDiagnosticCode =
  | "duplicate_event_id_ignored"
  | "invalid_metric_config";

export interface MetricDiagnostic {
  severity: "warning" | "error";
  code: MetricDiagnosticCode;
  message: string;
  evidenceEventIds: EventId[];
}

export interface FindingMetrics {
  firstFindTime: NumericMetric;
  averageSearchGap: NumericMetric;
  averagePostHookTargetAcquisition: NumericMetric;
}

export interface ChaseMetrics {
  firstChaseToFirstDown: NumericMetric;
  firstChaseToFirstHook: NumericMetric;
  averageChaseDuration: NumericMetric;
  abandonedChaseCount: NumericMetric;
}

export interface GeneratorControlMetrics {
  highProgressGeneratorLosses: NumericMetric;
  keyGeneratorInterruptions: NumericMetric;
}

export interface HookYieldMetrics {
  totalHooks: NumericMetric;
  uniqueSurvivorsHooked: NumericMetric;
  secondHookConversions: NumericMetric;
  firstEliminationTime: NumericMetric;
  firstHookChainEliminationTime: NumericMetric;
  hookConcentration: NumericMetric;
}

export interface MatchMetrics {
  finding: FindingMetrics;
  chase: ChaseMetrics;
  generatorControl: GeneratorControlMetrics;
  hookYield: HookYieldMetrics;
  diagnostics: MetricDiagnostic[];
}
