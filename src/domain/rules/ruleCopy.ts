import type { BreakpointDimension, RuleId } from "./types";

interface RuleCopy {
  title: string;
  dimension: Exclude<BreakpointDimension, "none">;
  message: string;
  practiceGoal: string;
}

export const RULE_COPY: Record<RuleId, RuleCopy> = {
  FIRST_CHASE_TOO_LONG: {
    title: "首次挂钩形成较晚",
    dimension: "chase",
    message:
      "本局数据显示首次挂钩形成较晚；该指标包含开局确认、首轮追击、搬运和挂钩，不能单独证明具体原因。",
    practiceGoal:
      "下一局可以优先练习开局找人路线，并在强资源区及时判断是否转火。",
  },
  SEARCH_GAP_TOO_LONG: {
    title: "追逐之间存在较长空窗",
    dimension: "finding",
    message: "本局数据显示，多次追逐之间可能存在较长的无目标空窗。",
    practiceGoal:
      "下一局可以减少无目标巡逻，并围绕高进度发电机寻找下一名逃生者。",
  },
  GENERATOR_CONTROL_WEAK: {
    title: "高进度发电机回防不足",
    dimension: "generator_control",
    message: "本局数据显示，有多台高进度发电机在再次有效干扰前完成。",
    practiceGoal:
      "下一局可以在挂钩后先检查高进度区域，再决定守钩或转火。",
  },
  HOOK_PRESSURE_DIFFUSE: {
    title: "挂钩压力较为分散",
    dimension: "hook_yield",
    message:
      "本局数据显示，在已有一定挂钩次数的情况下，首挂获救后的再次上钩较少，且减员形成较晚或没有形成。",
    practiceGoal:
      "下一局可以结合电机位置选择更有价值的追击目标。",
  },
};

export const NO_CLEAR_BREAKPOINT_COPY = {
  title: "未发现明确主要断点",
  message: "本局数据未发现明确主要节奏断点，或当前证据不足以稳定归因。",
  practiceGoal: "下一局可以继续记录关键事件，观察是否出现可重复的节奏模式。",
} as const;
