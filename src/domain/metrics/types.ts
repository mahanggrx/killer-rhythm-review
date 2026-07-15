import type { EventId } from "../log";

export type MetricUnit = "milliseconds" | "count" | "ratio";

export type MetricUnavailableReasonCode =
  | "missing_trial_start"
  | "missing_chase_start"
  | "missing_first_chase_end"
  | "missing_first_down"
  | "no_complete_chases"
  | "no_generator_progress_evidence"
  | "invalid_high_progress_threshold"
  | "no_elimination_event"
  | "abnormal_trial_end"
  | "non_finite_result"
  | "invalid_numeric_result";

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
  confidence: number;
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

export interface EngagementMetrics {
  averageChaseGap: NumericMetric;
}

export interface ChaseMetrics {
  firstChaseDuration: NumericMetric;
  firstChaseToFirstDown: NumericMetric;
  averageChaseDuration: NumericMetric;
  abandonedChaseCount: NumericMetric;
}

export interface GeneratorControlMetrics {
  highProgressGeneratorLosses: NumericMetric;
  keyGeneratorInterruptions: NumericMetric;
}

export interface EliminationMetrics {
  firstEliminationGeneratorsRemaining: NumericMetric;
  totalEliminations: NumericMetric;
}

export interface MatchMetrics {
  engagement: EngagementMetrics;
  chase: ChaseMetrics;
  generatorControl: GeneratorControlMetrics;
  elimination: EliminationMetrics;
  diagnostics: MetricDiagnostic[];
}
