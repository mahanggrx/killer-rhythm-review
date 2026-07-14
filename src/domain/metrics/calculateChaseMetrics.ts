import type {
  ChaseEndEvent,
  ChaseStartEvent,
  MatchEvent,
} from "../log";
import { availableMetric, mean, unavailableMetric } from "./shared";
import type { ChaseMetrics } from "./types";

interface CompleteChase {
  start: ChaseStartEvent;
  end: ChaseEndEvent;
  durationMs: number;
}

const ABANDONED_OR_LOST_END_REASONS = new Set<ChaseEndEvent["endReason"]>([
  "lost_los",
  "range_break",
  "locker",
  "target_switch",
]);

export function calculateChaseMetrics(
  events: readonly MatchEvent[],
): ChaseMetrics {
  const firstChaseIndex = events.findIndex(
    (event) => event.type === "chase_start",
  );
  const firstChase =
    firstChaseIndex >= 0 && events[firstChaseIndex].type === "chase_start"
      ? events[firstChaseIndex]
      : null;

  const startsByChaseId = new Map<string, ChaseStartEvent>();
  const closedChaseIds = new Set<string>();
  const completeChases: CompleteChase[] = [];
  const censoredEvidenceIds: string[] = [];

  for (const event of events) {
    if (event.type === "chase_start") {
      if (!startsByChaseId.has(event.chaseId)) {
        startsByChaseId.set(event.chaseId, event);
      }
      continue;
    }

    if (event.type !== "chase_end" || closedChaseIds.has(event.chaseId)) {
      continue;
    }

    const start = startsByChaseId.get(event.chaseId);

    if (!start || event.timestampMs < start.timestampMs) {
      continue;
    }

    closedChaseIds.add(event.chaseId);

    if (event.censored) {
      censoredEvidenceIds.push(start.eventId, event.eventId);
      continue;
    }

    const durationMs = event.timestampMs - start.timestampMs;

    if (Number.isFinite(durationMs) && durationMs >= 0) {
      completeChases.push({ start, end: event, durationMs });
    }
  }

  let firstChaseToFirstDown: ChaseMetrics["firstChaseToFirstDown"];
  let firstChaseToFirstHook: ChaseMetrics["firstChaseToFirstHook"];

  if (!firstChase) {
    firstChaseToFirstDown = unavailableMetric(
      "milliseconds",
      "missing_chase_start",
      "没有追逐开始事件。",
      "从第一次 chase_start 到其后首次由杀手造成的倒地时间。",
    );
    firstChaseToFirstHook = unavailableMetric(
      "milliseconds",
      "missing_chase_start",
      "没有追逐开始事件。",
      "从第一次 chase_start 到其后首次有效普通挂钩的首轮转化耗时，包含搬运和挂钩。",
    );
  } else {
    const laterEvents = events.slice(firstChaseIndex + 1);
    const firstDown = laterEvents.find(
      (event) =>
        event.type === "survivor_downed" && event.attribution === "killer",
    );
    const firstHook = laterEvents.find(
      (event) => event.type === "hook_completed" && event.isStandardHook,
    );

    firstChaseToFirstDown = firstDown
      ? availableMetric(
          firstDown.timestampMs - firstChase.timestampMs,
          "milliseconds",
          "从第一次 chase_start 到其后首次由杀手造成的 survivor_downed；不包含搬运时间。",
          [firstChase.eventId, firstDown.eventId],
          1,
        )
      : unavailableMetric(
          "milliseconds",
          "missing_first_down",
          "第一次追逐开始后没有可用的杀手归因倒地事件。",
          "从第一次 chase_start 到其后首次由杀手造成的倒地时间。",
          [firstChase.eventId],
        );

    firstChaseToFirstHook = firstHook
      ? availableMetric(
          firstHook.timestampMs - firstChase.timestampMs,
          "milliseconds",
          "从第一次 chase_start 到其后首次有效普通挂钩，包含追逐结束后的抱起、搬运和挂钩。",
          [firstChase.eventId, firstHook.eventId],
          1,
        )
      : unavailableMetric(
          "milliseconds",
          "missing_first_hook",
          "第一次追逐开始后没有有效普通挂钩事件。",
          "从第一次 chase_start 到其后首次有效普通挂钩的首轮转化耗时。",
          [firstChase.eventId],
        );
  }

  const averageDuration = mean(
    completeChases.map((chase) => chase.durationMs),
  );
  const completeEvidenceIds = completeChases.flatMap((chase) => [
    chase.start.eventId,
    chase.end.eventId,
  ]);
  const averageChaseDuration =
    averageDuration === null
      ? unavailableMetric(
          "milliseconds",
          "no_complete_chases",
          "没有非删失且起止完整的追逐区间。",
          "按独立 chaseId 配对 chase_start 与 chase_end；未结束或 censored 的追逐不进入平均值。",
          censoredEvidenceIds,
        )
      : availableMetric(
          averageDuration,
          "milliseconds",
          "所有非删失完整追逐的平均纯追逐时长，按独立 chaseId 配对，允许追逐短暂并发。",
          completeEvidenceIds,
          completeChases.length,
        );

  const abandonedChases = completeChases.filter((chase) =>
    ABANDONED_OR_LOST_END_REASONS.has(chase.end.endReason),
  );
  const abandonedChaseCount =
    completeChases.length === 0
      ? unavailableMetric(
          "count",
          "no_complete_chases",
          "没有完整追逐，无法判断目标丢失或转火次数。",
          "统计结束原因为目标丢失、距离中断、进入柜子或转火的完整追逐；不推测玩家主观意图。",
          censoredEvidenceIds,
        )
      : availableMetric(
          abandonedChases.length,
          "count",
          "统计结束原因为目标丢失、距离中断、进入柜子或转火的完整追逐；该指标不等同于认定玩家主动放弃。",
          abandonedChases.flatMap((chase) => [
            chase.start.eventId,
            chase.end.eventId,
          ]),
          abandonedChases.length,
        );

  return {
    firstChaseToFirstDown,
    firstChaseToFirstHook,
    averageChaseDuration,
    abandonedChaseCount,
  };
}
