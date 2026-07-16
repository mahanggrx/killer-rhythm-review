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

  let firstChaseDuration: ChaseMetrics["firstChaseDuration"];
  let firstChaseToFirstDown: ChaseMetrics["firstChaseToFirstDown"];

  if (!firstChase) {
    firstChaseDuration = unavailableMetric(
      "milliseconds",
      "missing_chase_start",
      "没有追逐开始事件。",
      "从第一次 chase_start 到同一 chaseId 的明确 chase_end，表示首个正式追逐区间的持续时间。",
    );
    firstChaseToFirstDown = unavailableMetric(
      "milliseconds",
      "missing_chase_start",
      "没有追逐开始事件。",
      "从第一次 chase_start 到其后首次由杀手造成的倒地时间。",
    );
  } else {
    const firstChaseEndIndex = events.findIndex(
      (event, index) =>
        index > firstChaseIndex &&
        event.type === "chase_end" &&
        event.chaseId === firstChase.chaseId &&
        event.survivorId === firstChase.survivorId,
    );
    const firstChaseEnd =
      firstChaseEndIndex >= 0 && events[firstChaseEndIndex].type === "chase_end"
        ? events[firstChaseEndIndex]
        : null;
    const convertedByDown =
      firstChaseEnd !== null &&
      !firstChaseEnd.censored &&
      firstChaseEnd.endReason === "target_downed";
    const firstDownIndex = convertedByDown
      ? events.findIndex(
          (event, index) =>
            index > firstChaseIndex &&
            index <= firstChaseEndIndex &&
            event.type === "survivor_downed" &&
            event.survivorId === firstChase.survivorId &&
            event.attribution === "killer",
        )
      : -1;
    const firstDown =
      firstDownIndex >= 0 && events[firstDownIndex].type === "survivor_downed"
        ? events[firstDownIndex]
        : null;
    const chaseEvidence = [
      firstChase.eventId,
      ...(firstChaseEnd ? [firstChaseEnd.eventId] : []),
    ];

    firstChaseDuration = firstChaseEnd && !firstChaseEnd.censored
      ? availableMetric(
          firstChaseEnd.timestampMs - firstChase.timestampMs,
          "milliseconds",
          "从第一次 chase_start 到同一 chaseId 的明确 chase_end；是否倒地、转火或丢失目标由结束原因单独说明，不以挂钩作为追逐结束。",
          chaseEvidence,
          1,
        )
      : unavailableMetric(
          "milliseconds",
          "missing_first_chase_end",
          firstChaseEnd
            ? "第一次追逐直到对局结束仍未结束，不能作为完整首追时长。"
            : "第一次追逐没有对应的结束事件。",
          "从第一次 chase_start 到同一 chaseId 的明确 chase_end。",
          chaseEvidence,
        );

    firstChaseToFirstDown = firstDown
      ? availableMetric(
          firstDown.timestampMs - firstChase.timestampMs,
          "milliseconds",
          "从第一次 chase_start 到同一 chaseId、同一逃生者在该追逐内首次由杀手造成的 survivor_downed；不包含搬运时间。",
          [firstChase.eventId, firstDown.eventId, ...(firstChaseEnd ? [firstChaseEnd.eventId] : [])],
          1,
        )
      : unavailableMetric(
          "milliseconds",
          "missing_first_down",
          "第一次追逐没有以同一目标倒地形成可验证的转化，或该追逐已被删失。",
          "仅关联第一次 chase_start 对应 chaseId 和 survivorId 内的杀手归因倒地。",
          chaseEvidence,
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
          "没有起止完整的追逐区间。",
          "按独立 chaseId 配对 chase_start 与 chase_end；直到对局结束仍未结束的追逐不进入平均值。",
          censoredEvidenceIds,
        )
      : availableMetric(
          averageDuration,
          "milliseconds",
          "所有起止完整追逐的平均纯追逐时长，按独立 chaseId 配对，允许追逐短暂并发。",
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
          completeEvidenceIds,
          completeChases.length,
        );

  return {
    firstChaseDuration,
    firstChaseToFirstDown,
    averageChaseDuration,
    abandonedChaseCount,
  };
}
