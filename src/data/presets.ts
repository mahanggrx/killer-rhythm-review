import firstChaseStartTooLate from "./samples/first-chase-start-too-late.json";
import averageChaseTooLong from "./samples/average-chase-too-long.json";
import lateFirstElimination from "./samples/late-first-elimination.json";

export interface PresetMatch {
  id: string;
  label: string;
  description: string;
  source: string;
  expectedPrimaryRuleId:
    | "FIRST_CHASE_START_TOO_LATE"
    | "AVERAGE_CHASE_TOO_LONG"
    | "LATE_FIRST_ELIMINATION";
}

function toSource(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export const PRESET_MATCHES: readonly PresetMatch[] = [
  {
    id: "first-chase-start-too-late",
    label: "Sample 01 · Late First Chase",
    description: "The first official chase begins 50 seconds after match start.",
    source: toSource(firstChaseStartTooLate),
    expectedPrimaryRuleId: "FIRST_CHASE_START_TOO_LATE",
  },
  {
    id: "average-chase-too-long",
    label: "Sample 02 · Long Average Chase",
    description: "Three complete chases each last 55 seconds.",
    source: toSource(averageChaseTooLong),
    expectedPrimaryRuleId: "AVERAGE_CHASE_TOO_LONG",
  },
  {
    id: "late-first-elimination",
    label: "Sample 03 · Late First Elimination",
    description: "Four generators are completed before the first elimination.",
    source: toSource(lateFirstElimination),
    expectedPrimaryRuleId: "LATE_FIRST_ELIMINATION",
  },
] as const;

export const DEFAULT_PRESET_ID = PRESET_MATCHES[0].id;
