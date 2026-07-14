import firstChaseTooLong from "./samples/first-chase-too-long.json";
import highProgressGeneratorsLost from "./samples/high-progress-generators-lost.json";
import hookPressureDiffuse from "./samples/hook-pressure-diffuse.json";

export interface PresetMatch {
  id: string;
  label: string;
  description: string;
  source: string;
  expectedPrimaryRuleId:
    | "FIRST_CHASE_TOO_LONG"
    | "GENERATOR_CONTROL_WEAK"
    | "HOOK_PRESSURE_DIFFUSE";
}

function toSource(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export const PRESET_MATCHES: readonly PresetMatch[] = [
  {
    id: "first-chase-too-long",
    label: "样例 01 · 首追过长",
    description: "首次追逐开始后 88 秒才形成首挂，其他规则不越过默认阈值。",
    source: toSource(firstChaseTooLong),
    expectedPrimaryRuleId: "FIRST_CHASE_TOO_LONG",
  },
  {
    id: "high-progress-generators-lost",
    label: "样例 02 · 高进度发电机丢失",
    description: "两台进入高进度区间的发电机在再次有效干扰前完成。",
    source: toSource(highProgressGeneratorsLost),
    expectedPrimaryRuleId: "GENERATOR_CONTROL_WEAK",
  },
  {
    id: "hook-pressure-diffuse",
    label: "样例 03 · 挂数分散",
    description: "四次首挂分布在四名逃生者身上，未形成再次上钩或永久减员。",
    source: toSource(hookPressureDiffuse),
    expectedPrimaryRuleId: "HOOK_PRESSURE_DIFFUSE",
  },
] as const;

export const DEFAULT_PRESET_ID = PRESET_MATCHES[0].id;
