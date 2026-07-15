import firstChaseTooLong from "./samples/first-chase-too-long.json";
import lateFirstElimination from "./samples/late-first-elimination.json";
import engagementGapTooLong from "./samples/engagement-gap-too-long.json";

export interface PresetMatch {
  id: string;
  label: string;
  description: string;
  source: string;
  expectedPrimaryRuleId:
    | "FIRST_CHASE_TOO_LONG"
    | "LATE_FIRST_ELIMINATION"
    | "ENGAGEMENT_GAP_TOO_LONG";
}

function toSource(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export const PRESET_MATCHES: readonly PresetMatch[] = [
  {
    id: "first-chase-too-long",
    label: "样例 01 · 首追过长",
    description: "首次正式追逐从生效到结束持续 78 秒，不依赖倒地后的挂钩结果。",
    source: toSource(firstChaseTooLong),
    expectedPrimaryRuleId: "FIRST_CHASE_TOO_LONG",
  },
  {
    id: "late-first-elimination",
    label: "样例 02 · 首次减员较晚",
    description: "首次永久减员形成前已有四台发电机完成，剩余一个基础修理目标。",
    source: toSource(lateFirstElimination),
    expectedPrimaryRuleId: "LATE_FIRST_ELIMINATION",
  },
  {
    id: "engagement-gap-too-long",
    label: "样例 03 · 接敌空窗较长",
    description: "开局与后续两次完整追逐之间均存在 50 秒空窗，平均追逐空窗为 50 秒。",
    source: toSource(engagementGapTooLong),
    expectedPrimaryRuleId: "ENGAGEMENT_GAP_TOO_LONG",
  },
] as const;

export const DEFAULT_PRESET_ID = PRESET_MATCHES[0].id;
