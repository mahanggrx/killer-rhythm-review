/** English display copy. Core calculations and raw log schemas remain unchanged. */
const substitutions: ReadonlyArray<readonly [string, string]> = [
  [
    "本局数据显示，首次永久减员形成时，基础修理目标只剩 ",
    "In this match, only "
  ],
  [
    " 台。",
    " generator objective(s) remained at the first elimination."
  ],
  [
    "本局数据显示，从对局开始到首次游戏正式追逐生效的时间较长。",
    "The first official chase started relatively late in this match."
  ],
  [
    "本局数据显示，多段完整正式追逐从生效到结束的平均时间较长。",
    "Across completed chases, the average time from chase start to end was relatively long."
  ],
  [
    "本局数据显示，首次永久减员形成时发电机修理目标已经所剩较少，或完整对局没有形成永久减员。",
    "The first elimination came late relative to generator progress, or no elimination occurred."
  ],
  [
    "本局日志正常结束，但没有记录到献祭、处决或流血死亡。该结论不把逃脱或 BOT 接管计为杀手减员。",
    "The match ended normally with no sacrifice, kill, or bleed-out recorded. Escapes and bot takeovers do not count as eliminations."
  ],
  [
    "本局数据未发现明确主要节奏断点，或当前证据不足以稳定归因。",
    "No clear major pacing issue was found, or the available events are insufficient for a reliable conclusion."
  ],
  [
    "下一局可以练习规划开局巡逻路线，并留意划痕、乌鸦、声音和爆点提示，尽早建立第一段追逐压力。",
    "Next match: plan your opening patrol and watch for scratch marks, crows, sounds, and notifications to start applying chase pressure sooner."
  ],
  [
    "下一局可以减少低收益追逐，或加强对高进度区域的持续回防，尝试更早建立整体压力。",
    "Next match: reconsider low-value chases and defend high-progress generators to build pressure earlier."
  ],
  [
    "下一局可以练习更早识别高成本资源区，并在追逐收益下降时及时中止，把压力转向其他目标或发电机区域。",
    "Next match: identify strong looping areas earlier and consider switching targets or defending generators when a chase stops paying off."
  ],
  [
    "下一局可以继续记录关键事件，观察是否出现可重复的节奏模式。",
    "Next match: keep observing key events to see whether any pacing pattern repeats."
  ],
  [
    "首次进入追逐较晚",
    "Late First Chase"
  ],
  [
    "平均追击时间较长",
    "Long Average Chase"
  ],
  [
    "首次减员形成较晚",
    "Late First Elimination"
  ],
  [
    "本局未形成永久减员",
    "No Survivor Eliminated"
  ],
  [
    "未发现明确主要断点",
    "No Clear Pacing Issue"
  ],
  [
    "减员结果",
    "Elimination"
  ],
  [
    "证据不足",
    "Insufficient Evidence"
  ],
  [
    "接敌节奏",
    "Engagement"
  ],
  [
    "追击效率",
    "Chase Performance"
  ],
  [
    "发电机控制",
    "Generator Control"
  ],
  [
    "首次进入追逐时间",
    "Time to First Chase"
  ],
  [
    "平均追逐空窗",
    "Average Gap Between Chases"
  ],
  [
    "首次追逐时长",
    "First Chase Duration"
  ],
  [
    "首追至首次倒地",
    "First Chase to First Down"
  ],
  [
    "完整追逐平均时长",
    "Average Completed Chase"
  ],
  [
    "放弃或转火追逐",
    "Chases Ended by Loss or Switch"
  ],
  [
    "首次减员时剩余修理目标",
    "Generators Remaining at First Elimination"
  ],
  [
    "永久减员总数",
    "Total Eliminations"
  ],
  [
    "献祭、处决和流血死亡",
    "Sacrifice, kill, or bleed-out"
  ],
  [
    "参考：",
    "Reference: "
  ],
  [
    "规则参考：",
    "Rule reference: "
  ],
  [
    "未设置诊断阈值",
    "No diagnostic threshold"
  ],
  [
    "控机指即时掉进度、开始回退或封锁；同一台最多计 1 台",
    "Interference means an applied loss, regression, or block; each generator counts once."
  ],
  [
    "同一次杀手行为的多个控机效果合并为 1 次",
    "Multiple effects of one Killer action count as one interference."
  ],
  [
    "高进度电机达到 ",
    "Generators reaching "
  ],
  [
    " 后未被控机即修开",
    " completed without Killer interference"
  ],
  [
    "对进度 ≥ ",
    "Interference on generators at ≥ "
  ],
  [
    " 的高进度电机控机",
    " progress"
  ],
  [
    "不可用",
    "Unavailable"
  ],
  [
    " 秒",
    " s"
  ],
  [
    "追逐开始",
    "Chase Started"
  ],
  [
    "追逐结束",
    "Chase Ended"
  ],
  [
    "对局开始",
    "Match Started"
  ],
  [
    "分析计时起点",
    "Analysis start time"
  ],
  [
    "逃生者倒地",
    "Survivor Downed"
  ],
  [
    "有效普通挂钩",
    "Standard Hook"
  ],
  [
    "非普通挂钩记录",
    "Non-standard Hook"
  ],
  [
    "逃生者离钩",
    "Survivor Unhooked"
  ],
  [
    "开始修理",
    "Repair Started"
  ],
  [
    "停止修理",
    "Repair Stopped"
  ],
  [
    "发电机进度变化",
    "Generator Progress Changed"
  ],
  [
    "回退开始",
    "Regression Started"
  ],
  [
    "回退暂停",
    "Regression Paused"
  ],
  [
    "回退恢复",
    "Regression Resumed"
  ],
  [
    "回退停止",
    "Regression Stopped"
  ],
  [
    "发电机封锁",
    "Generator Blocked"
  ],
  [
    "发电机解除封锁",
    "Generator Unblocked"
  ],
  [
    "发电机完成",
    "Generator Completed"
  ],
  [
    "永久减员",
    "Elimination"
  ],
  [
    "失去视野",
    "Lost Line of Sight"
  ],
  [
    "脱离判定范围",
    "Out of Chase Range"
  ],
  [
    "进入柜子",
    "Entered Locker"
  ],
  [
    "目标倒地",
    "Target Downed"
  ],
  [
    "转向其他目标",
    "Switched Target"
  ],
  [
    "对局结束",
    "Match Ended"
  ],
  [
    "原因未知",
    "Unknown Reason"
  ],
  [
    "献祭",
    "Sacrificed"
  ],
  [
    "处决",
    "Killed"
  ],
  [
    "流血死亡",
    "Bled Out"
  ],
  [
    "逃脱",
    "Escaped"
  ],
  [
    "记录类型",
    "Event Type"
  ],
  [
    "逃生者",
    "Survivor"
  ],
  [
    "追逐 ID",
    "Chase ID"
  ],
  [
    "记录来源",
    "Event Source"
  ],
  [
    "游戏正式追逐状态",
    "Official Chase State"
  ],
  [
    "结束原因",
    "End Reason"
  ],
  [
    "删失区间",
    "Censored Interval"
  ],
  [
    "策略生成",
    "Generated by Normalization"
  ],
  [
    "原因",
    "Cause"
  ],
  [
    "归因",
    "Attribution"
  ],
  [
    "挂钩编号",
    "Hook Number"
  ],
  [
    "挂钩阶段",
    "Hook Stage"
  ],
  [
    "普通挂钩",
    "Standard Hook"
  ],
  [
    "救援者",
    "Rescuer"
  ],
  [
    "离钩方式",
    "Unhook Method"
  ],
  [
    "离钩阶段",
    "Stage at Release"
  ],
  [
    "发电机",
    "Generator"
  ],
  [
    "记录进度",
    "Recorded Progress"
  ],
  [
    "进度变化",
    "Progress Change"
  ],
  [
    "杀手造成",
    "Caused by Killer"
  ],
  [
    "实际生效",
    "Applied"
  ],
  [
    "干扰 ID",
    "Interference ID"
  ],
  [
    "回退 ID",
    "Regression ID"
  ],
  [
    "来源",
    "Source"
  ],
  [
    "完成序号",
    "Completion Order"
  ],
  [
    "记录贡献者",
    "Contributors"
  ],
  [
    "结果",
    "Outcome"
  ],
  [
    "无",
    "None"
  ],
  [
    "是",
    "Yes"
  ],
  [
    "否",
    "No"
  ],
  [
    "第 ",
    "#"
  ],
  [
    " 次上钩",
    " hook"
  ],
  [
    " 台",
    " generator(s)"
  ],
  [
    " 次",
    " time(s)"
  ],
  [
    " 人",
    " Survivor(s)"
  ],
  [
    " 低于规则最低要求 ",
    " below required sample size "
  ],
  [
    " 样本量 ",
    " sample size "
  ],
  [
    "本局没有游戏正式追逐开始事件，无法计算首次进入追逐时间。",
    "No official chase-start event was recorded; time to first chase cannot be calculated."
  ],
  [
    "本局没有游戏正式追逐开始事件，无法形成追逐空窗样本。",
    "No chase-start event was recorded, so there are no usable chase-gap samples."
  ],
  [
    "缺少对局开始事件，无法确定首次进入追逐的计时起点。",
    "No match-start event; the first-chase timer has no starting point."
  ],
  [
    "没有起止完整的追逐区间。",
    "There are no completed chase intervals."
  ],
  [
    "没有追逐开始事件。",
    "No chase-start event was recorded."
  ],
  [
    "第一次追逐没有对应的结束事件。",
    "The first chase has no matching end event."
  ],
  [
    "第一次追逐直到对局结束仍未结束，不能作为完整首追时长。",
    "The first chase was still open at match end and is excluded from completed duration."
  ],
  [
    "第一次追逐没有以同一目标倒地形成可验证的转化，或该追逐已被删失。",
    "The first chase has no confirmed down of the same Survivor, or the interval was censored."
  ],
  [
    "没有完整追逐，无法判断目标丢失或转火次数。",
    "There are no completed chases to count target losses or switches."
  ],
  [
    "本局正常结束，但没有形成永久减员。",
    "The match ended with no Survivor elimination."
  ],
  [
    "当前日志没有可验证的首次永久减员。",
    "The log has no verifiable first elimination."
  ],
  [
    "对局没有正常结束，不能把当前记录视为完整的最终减员结果。",
    "The match did not end normally; final elimination results cannot be treated as complete."
  ],
  [
    "日志没有记录发电机完成前的阶段进度，无法判断它是否达到 ",
    "No generator-progress evidence was recorded before completion, so the threshold of "
  ],
  [
    "，也无法判断完成前是否被控机；这不代表数量为 0。",
    " and the effect of interference cannot be determined. This does not imply zero."
  ],
  [
    "日志没有发电机阶段进度或杀手控机证据，不能判断对进度达到 ",
    "There is insufficient generator progress/interference evidence for the "
  ],
  [
    " 的高进度发电机的控机次数；这不代表次数为 0。",
    " threshold. This does not imply zero."
  ],
  [
    "高进度阈值必须是 0 到 1 之间的有限数值。",
    "The high-progress threshold must be a finite number from 0 to 1."
  ],
  [
    "指标兜底计算只保留规范化排序后的第一条。正式分析仍应由输入校验阻止该日志。",
    "Only the first normalized event is used for metric fallback; input validation should reject the log."
  ],
  [
    "JSON 语法错误，无法解析日志",
    "JSON syntax error; unable to parse the match log"
  ],
  [
    "日志根节点必须是对象",
    "The log root must be an object"
  ],
  [
    "事件未按 timestampMs 与 eventOrder 排序，解析成功后将稳定排序",
    "Events were out of order and have been sorted by timestamp and event order"
  ],
  [
    "日志声明了基础规则集之外的机制：",
    "The log declares mechanics outside the supported base ruleset: "
  ],
  [
    "。分析结果仅适用于基础规则集。",
    ". This analysis only supports the base ruleset."
  ],
  [
    "生成日志的指标回算结果与输入不一致，已停止使用该结果。",
    "Calculated metrics did not match the generated inputs; the result was rejected."
  ],
  [
    "目标丢失或转火次数不能超过完整追逐次数。",
    "Lost or switched chases cannot exceed the number of completed chases."
  ],
  [
    "必须是有限数值",
    "must be a finite number"
  ],
  [
    "必须使用整数",
    "must be an integer"
  ],
  [
    "必须在 ",
    "must be within "
  ],
  [
    " 之间",
    " and "
  ],
  [
    "必须是",
    "must be"
  ],
  [
    "必须包含",
    "must include"
  ],
  [
    "必须且只能包含",
    "must contain exactly"
  ],
  [
    "必须为",
    "must be"
  ],
  [
    "不得为负数",
    "must not be negative"
  ],
  [
    "必须是非空字符串",
    "must be a non-empty string"
  ],
  [
    "必须是布尔值",
    "must be a boolean"
  ],
  [
    "必须是对象",
    "must be an object"
  ],
  [
    "必须是数组",
    "must be an array"
  ],
  [
    "未知事件类型：",
    "Unknown event type: "
  ],
  [
    "事件时间不得超过对局总时长",
    "Event time cannot exceed match duration"
  ],
  [
    "事件 ID ",
    "Event ID "
  ],
  [
    "重复",
    " is duplicated"
  ],
  [
    "当前原型只验证 ",
    "This prototype only validates "
  ],
  [
    "机制基线",
    " mechanics baseline"
  ],
  [
    "仅支持规则集 ",
    "Only ruleset "
  ],
  [
    "仅支持日志版本 ",
    "Only log version "
  ],
  [
    "日志必须且只能包含一个 ",
    "The log must contain exactly one "
  ],
  [
    "事件必须是对象",
    "Each event must be an object"
  ],
  [
    "未支持机制名称必须是非空字符串",
    "Unsupported mechanic name must be a non-empty string"
  ]
];

export function english(text: string | null | undefined): string {
  if (text == null) return "";
  let output = text;
  for (const [source, translated] of substitutions) {
    // Single-character terms are standalone values, not arbitrary text fragments.
    if (source.length === 1 && output !== source) continue;
    output = output.replaceAll(source, translated);
  }
  return output;
}
