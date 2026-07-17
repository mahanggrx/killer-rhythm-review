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
    label: "样例 01 · 首次进入追逐较晚",
    description: "对局开始 50 秒后才首次进入游戏正式追逐。",
    source: toSource(firstChaseStartTooLate),
    expectedPrimaryRuleId: "FIRST_CHASE_START_TOO_LATE",
  },
  {
    id: "average-chase-too-long",
    label: "样例 02 · 平均追击时间较长",
    description: "三段完整正式追逐均持续 55 秒，平均追逐时长为 55 秒。",
    source: toSource(averageChaseTooLong),
    expectedPrimaryRuleId: "AVERAGE_CHASE_TOO_LONG",
  },
  {
    id: "late-first-elimination",
    label: "样例 03 · 首次减员形成较晚",
    description: "首次永久减员形成前已有四台发电机完成，剩余一个基础修理目标。",
    source: toSource(lateFirstElimination),
    expectedPrimaryRuleId: "LATE_FIRST_ELIMINATION",
  },
] as const;

export const DEFAULT_PRESET_ID = PRESET_MATCHES[0].id;
