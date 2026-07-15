import type { MatchLog } from "../log";

export interface SyntheticLogInput {
  averageChaseGapSeconds: number;
  firstChaseDurationSeconds: number;
  generatorsRemainingAtFirstElimination: number;
}

export type SyntheticLogInputField = keyof SyntheticLogInput;

export interface SyntheticLogInputIssue {
  field: SyntheticLogInputField | "generator";
  code:
    | "NOT_FINITE"
    | "NOT_INTEGER"
    | "OUT_OF_RANGE"
    | "GENERATED_LOG_INVALID"
    | "SELF_CHECK_FAILED";
  message: string;
}

export interface SyntheticLogVerification {
  averageChaseGapSeconds: number;
  firstChaseDurationSeconds: number;
  generatorsRemainingAtFirstElimination: number;
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
  minimumFirstChaseSeconds: 1,
  minimumGeneratorsRemaining: 0,
  maximumGeneratorsRemaining: 5,
} as const;

export const DEFAULT_SYNTHETIC_LOG_INPUT: Readonly<SyntheticLogInput> = {
  averageChaseGapSeconds: 20,
  firstChaseDurationSeconds: 78,
  generatorsRemainingAtFirstElimination: 2,
};
