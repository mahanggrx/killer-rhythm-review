import type { BreakpointDimension, RuleId } from "./types";

interface RuleCopy {
  title: string;
  dimension: Exclude<BreakpointDimension, "none">;
  message: string;
  practiceGoal: string;
}

export const RULE_COPY: Record<RuleId, RuleCopy> = {
  FIRST_CHASE_START_TOO_LATE: {
    title: "首次进入追逐较晚",
    dimension: "engagement",
    message:
      "本局数据显示，从对局开始到首次游戏正式追逐生效的时间较长。",
    practiceGoal:
      "下一局可以练习规划开局巡逻路线，并留意划痕、乌鸦、声音和爆点提示，尽早建立第一段追逐压力。",
  },
  LATE_FIRST_ELIMINATION: {
    title: "首次减员形成较晚",
    dimension: "elimination",
    message:
      "本局数据显示，首次永久减员形成时发电机修理目标已经所剩较少，或完整对局没有形成永久减员。",
    practiceGoal:
      "下一局可以减少低收益追逐，或加强对高进度区域的持续回防，尝试更早建立整体压力。",
  },
  AVERAGE_CHASE_TOO_LONG: {
    title: "平均追击时间较长",
    dimension: "chase",
    message:
      "本局数据显示，多段完整正式追逐从生效到结束的平均时间较长。",
    practiceGoal:
      "下一局可以练习更早识别高成本资源区，并在追逐收益下降时及时中止，把压力转向其他目标或发电机区域。",
  },
};

export const NO_CLEAR_BREAKPOINT_COPY = {
  title: "未发现明确主要断点",
  message: "本局数据未发现明确主要节奏断点，或当前证据不足以稳定归因。",
  practiceGoal: "下一局可以继续记录关键事件，观察是否出现可重复的节奏模式。",
} as const;
