import type { MatchEvent, MatchLog } from "../log";
import type { TimelineDetail, TimelineEventKind, TimelineItem } from "./types";

interface TimelineCopy {
  kind: TimelineEventKind;
  label: string;
  summary: string;
  details: TimelineDetail[];
  defaultVisible: boolean;
}

const chaseEndReasonCopy: Record<string, string> = {
  lost_los: "失去视野",
  range_break: "脱离判定范围",
  locker: "进入柜子",
  target_downed: "目标倒地",
  target_switch: "转向其他目标",
  trial_end: "对局结束",
  unknown: "原因未知",
};

const outcomeCopy: Record<string, string> = {
  sacrificed: "献祭",
  killed: "处决",
  bled_out: "流血死亡",
  escaped: "逃脱",
};

function progressText(progress: number): string {
  return `${Math.round(progress * 100)}%`;
}

export function formatMatchTime(timestampMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toTimelineCopy(event: MatchEvent): TimelineCopy | null {
  switch (event.type) {
    case "trial_start":
      return {
        kind: "match",
        label: "对局开始",
        summary: "分析计时起点",
        details: [{ label: "记录类型", value: "对局开始" }],
        defaultVisible: false,
      };
    case "chase_start":
      return {
        kind: "chase",
        label: "追逐开始",
        summary: `${event.survivorId} · ${event.chaseId}`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "追逐 ID", value: event.chaseId },
          { label: "记录来源", value: "游戏正式追逐状态" },
        ],
        defaultVisible: true,
      };
    case "chase_end":
      return {
        kind: "chase",
        label: "追逐结束",
        summary: `${event.survivorId} · ${chaseEndReasonCopy[event.endReason]}`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "追逐 ID", value: event.chaseId },
          { label: "结束原因", value: chaseEndReasonCopy[event.endReason] },
          { label: "删失区间", value: event.censored ? "是" : "否" },
          { label: "策略生成", value: event.policyGenerated ? "是" : "否" },
        ],
        defaultVisible: true,
      };
    case "survivor_downed":
      return {
        kind: "down",
        label: "逃生者倒地",
        summary: `${event.survivorId} · ${event.cause}`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "原因", value: event.cause },
          { label: "归因", value: event.attribution },
        ],
        defaultVisible: true,
      };
    case "hook_completed":
      return {
        kind: "hook",
        label: event.isStandardHook ? "有效普通挂钩" : "非普通挂钩记录",
        summary: `${event.survivorId} · 第 ${event.hookNumber} 次上钩`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "挂钩编号", value: String(event.hookNumber) },
          { label: "挂钩阶段", value: `${event.stageBefore} → ${event.stageAfter}` },
          { label: "普通挂钩", value: event.isStandardHook ? "是" : "否" },
        ],
        defaultVisible: true,
      };
    case "survivor_unhooked":
      return {
        kind: "hook",
        label: "逃生者离钩",
        summary: `${event.survivorId} · ${event.method}`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "救援者", value: event.rescuerId ?? "无" },
          { label: "离钩方式", value: event.method },
          { label: "离钩阶段", value: String(event.stageAtRelease) },
        ],
        defaultVisible: false,
      };
    case "generator_repair_started":
    case "generator_repair_stopped":
      return {
        kind: "generator",
        label: event.type === "generator_repair_started" ? "开始修理" : "停止修理",
        summary: `${event.generatorId} · ${progressText(event.progress)}`,
        details: [
          { label: "发电机", value: event.generatorId },
          { label: "逃生者", value: event.survivorId },
          { label: "记录进度", value: progressText(event.progress) },
        ],
        defaultVisible: false,
      };
    case "generator_progress_delta":
      return {
        kind: "generator",
        label: "发电机进度变化",
        summary: `${event.generatorId} · ${progressText(event.progressBefore)} → ${progressText(event.progressAfter)}`,
        details: [
          { label: "发电机", value: event.generatorId },
          { label: "进度变化", value: `${progressText(event.progressBefore)} → ${progressText(event.progressAfter)}` },
          { label: "杀手造成", value: event.killerCaused ? "是" : "否" },
          { label: "实际生效", value: event.applied ? "是" : "否" },
          { label: "干扰 ID", value: event.interferenceId ?? "无" },
        ],
        defaultVisible: false,
      };
    case "generator_regression_started":
    case "generator_regression_paused":
    case "generator_regression_resumed":
    case "generator_regression_stopped":
      return {
        kind: "generator",
        label: {
          generator_regression_started: "回退开始",
          generator_regression_paused: "回退暂停",
          generator_regression_resumed: "回退恢复",
          generator_regression_stopped: "回退停止",
        }[event.type],
        summary: `${event.generatorId} · ${progressText(event.progress)}`,
        details: [
          { label: "发电机", value: event.generatorId },
          { label: "回退 ID", value: event.regressionId },
          { label: "记录进度", value: progressText(event.progress) },
          ...(event.type === "generator_regression_stopped"
            ? [
                { label: "删失区间", value: event.censored ? "是" : "否" },
                { label: "策略生成", value: event.policyGenerated ? "是" : "否" },
              ]
            : []),
        ],
        defaultVisible: false,
      };
    case "generator_blocked":
    case "generator_unblocked":
      return {
        kind: "generator",
        label: event.type === "generator_blocked" ? "发电机封锁" : "发电机解除封锁",
        summary: `${event.generatorId} · ${progressText(event.progress)}`,
        details: [
          { label: "发电机", value: event.generatorId },
          { label: "记录进度", value: progressText(event.progress) },
          { label: "来源", value: event.source },
          ...(event.type === "generator_blocked"
            ? [{ label: "干扰 ID", value: event.interferenceId }]
            : []),
        ],
        defaultVisible: false,
      };
    case "generator_completed":
      return {
        kind: "generator",
        label: "发电机完成",
        summary: `${event.generatorId} · 第 ${event.completionIndex} 台`,
        details: [
          { label: "发电机", value: event.generatorId },
          { label: "完成序号", value: String(event.completionIndex) },
          { label: "记录贡献者", value: event.contributors.join("、") || "无" },
        ],
        defaultVisible: true,
      };
    case "survivor_outcome":
      if (event.outcomeType === "escaped") {
        return null;
      }
      return {
        kind: "elimination",
        label: "永久减员",
        summary: `${event.survivorId} · ${outcomeCopy[event.outcomeType]}`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "结果", value: outcomeCopy[event.outcomeType] },
          { label: "原因", value: event.cause },
          { label: "归因", value: event.attribution },
        ],
        defaultVisible: true,
      };
    default:
      return null;
  }
}

export function buildEventTimeline(
  log: MatchLog,
  evidenceEventIds: readonly string[] = [],
): TimelineItem[] {
  const evidenceIds = new Set(evidenceEventIds);
  const latestTimestamp = log.events.reduce(
    (latest, event) => Math.max(latest, event.timestampMs),
    0,
  );
  const durationMs = Math.max(log.durationMs, latestTimestamp, 1);

  return log.events.flatMap((event): TimelineItem[] => {
    const copy = toTimelineCopy(event);

    if (copy === null || (!copy.defaultVisible && !evidenceIds.has(event.eventId))) {
      return [];
    }

    return [
      {
        eventId: event.eventId,
        eventType: event.type,
        timestampMs: event.timestampMs,
        timeLabel: formatMatchTime(event.timestampMs),
        positionPercent: Math.min(100, Math.max(0, (event.timestampMs / durationMs) * 100)),
        kind: copy.kind,
        label: copy.label,
        summary: copy.summary,
        details: copy.details,
        isEvidence: evidenceIds.has(event.eventId),
      },
    ];
  });
}
