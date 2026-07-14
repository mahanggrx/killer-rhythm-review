import type { MatchEvent, MatchLog } from "../log";
import type { TimelineDetail, TimelineEventKind, TimelineItem } from "./types";

interface TimelineCopy {
  kind: TimelineEventKind;
  label: string;
  summary: string;
  details: TimelineDetail[];
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

const evidenceTypeCopy: Record<string, string> = {
  direct_los: "直接视野",
  aura: "气场",
  scream: "尖叫",
  killer_instinct: "杀手本能",
  scratch_marks: "足迹",
  blood: "血迹",
  sound: "声音",
  manual: "人工记录",
};

const confidenceCopy: Record<string, string> = {
  confirmed: "确认",
  probable: "较可信",
  uncertain: "不确定",
};

const outcomeCopy: Record<string, string> = {
  sacrificed: "献祭",
  killed: "处决",
  bled_out: "流血死亡",
  escaped: "逃脱",
};

export function formatMatchTime(timestampMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(timestampMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function toTimelineCopy(event: MatchEvent): TimelineCopy | null {
  switch (event.type) {
    case "target_acquired":
      return {
        kind: "acquired",
        label: "确认目标",
        summary: `${event.survivorId} · ${evidenceTypeCopy[event.evidenceType]}`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "证据类型", value: evidenceTypeCopy[event.evidenceType] },
          { label: "置信度", value: confidenceCopy[event.confidence] },
          { label: "观察备注", value: event.observerNote },
        ],
      };
    case "chase_start":
      return {
        kind: "chase",
        label: "追逐开始",
        summary: `${event.survivorId} · ${event.chaseId}`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "追逐 ID", value: event.chaseId },
          { label: "记录来源", value: event.source === "game_state" ? "游戏状态" : "人工记录" },
        ],
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
      };
    case "hook_completed":
      return {
        kind: "hook",
        label: "有效挂钩",
        summary: `${event.survivorId} · 第 ${event.hookNumber} 次上钩`,
        details: [
          { label: "逃生者", value: event.survivorId },
          { label: "挂钩编号", value: String(event.hookNumber) },
          { label: "挂钩阶段", value: `${event.stageBefore} → ${event.stageAfter}` },
          { label: "普通挂钩", value: event.isStandardHook ? "是" : "否" },
        ],
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

    if (copy === null) {
      return [];
    }

    return [
      {
        eventId: event.eventId,
        eventType: event.type,
        timestampMs: event.timestampMs,
        timeLabel: formatMatchTime(event.timestampMs),
        positionPercent: Math.min(100, Math.max(0, (event.timestampMs / durationMs) * 100)),
        ...copy,
        isEvidence: evidenceIds.has(event.eventId),
      },
    ];
  });
}
