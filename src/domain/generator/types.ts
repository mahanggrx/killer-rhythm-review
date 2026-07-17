import type { MatchLog } from "../log";

export interface SyntheticLogInput {
  firstChaseStartSeconds: number;
  averageChaseDurationSeconds: number;
  generatorsRemainingAtFirstElimination: number;
  completeChaseCount?: number;
  firstChaseDurationSeconds?: number;
  abandonedChaseCount?: number;
  highProgressGeneratorLosses?: number;
  keyGeneratorInterruptions?: number;
  totalEliminations?: number;
}

export type SyntheticLogInputField = keyof SyntheticLogInput;

export interface SyntheticLogInputIssue {
  field: SyntheticLogInputField | "generator";
  code:
    | "NOT_FINITE"
    | "NOT_INTEGER"
    | "OUT_OF_RANGE"
    | "INCONSISTENT_INPUT"
    | "GENERATED_LOG_INVALID"
    | "SELF_CHECK_FAILED";
  message: string;
}

export interface SyntheticLogVerification {
  firstChaseStartSeconds: number;
  averageChaseDurationSeconds: number;
  generatorsRemainingAtFirstElimination: number;
  completeChaseCount: number;
  firstChaseDurationSeconds: number;
  averageChaseGapSeconds: number;
  abandonedChaseCount: number;
  highProgressGeneratorLosses: number;
  keyGeneratorInterruptions: number;
  totalEliminations: number;
}

export interface SyntheticLogSuccess {
  ok: true;
  log: MatchLog;
  source: string;
  verification: SyntheticLogVerification;
}

export interface SyntheticLogFailure {
  ok: false;
  errors: SyntheticLogInputIssue[];
}

export type SyntheticLogResult = SyntheticLogSuccess | SyntheticLogFailure;

export const SYNTHETIC_LOG_LIMITS = {
  minimumSeconds: 0,
  maximumSeconds: 3600,
  minimumAverageChaseSeconds: 1,
  minimumFirstChaseSeconds: 1,
  minimumGeneratorsRemaining: 0,
  maximumGeneratorsRemaining: 5,
  minimumCompleteChases: 1,
  maximumCompleteChases: 12,
  minimumAbandonedChases: 0,
  maximumHighProgressGeneratorLosses: 5,
  maximumKeyGeneratorInterruptions: 20,
  minimumEliminations: 1,
  maximumEliminations: 4,
} as const;

export const DEFAULT_SYNTHETIC_LOG_INPUT: Readonly<SyntheticLogInput> = {
  firstChaseStartSeconds: 50,
  averageChaseDurationSeconds: 30,
  generatorsRemainingAtFirstElimination: 2,
};
