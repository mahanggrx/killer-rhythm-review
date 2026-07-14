import type {
  ChaseEndEvent,
  HookCompletedEvent,
  MatchEvent,
} from "../log";
import { availableMetric, mean, unavailableMetric } from "./shared";
import type { FindingMetrics } from "./types";

const TARGET_CONFIDENCE_WEIGHT = {
  confirmed: 1,
  probable: 0.75,
  uncertain: 0.5,
} as const;

export function calculateFindingMetrics(
  events: readonly MatchEvent[],
): FindingMetrics {
  const trialStartIndex = events.findIndex(
    (event) => event.type === "trial_start",
  );
  const firstTargetIndex = events.findIndex(
    (event, index) =>
      index > trialStartIndex && event.type === "target_acquired",
  );

  let firstFindTime: FindingMetrics["firstFindTime"];

  if (trialStartIndex < 0) {
    firstFindTime = unavailableMetric(
      "milliseconds",
      "missing_trial_start",
      "缺少对局开始事件，无法确定首次目标确认的计时起点。",
      "从 trial_start 到首次人工标注 target_acquired 的时间。",
    );
  } else if (firstTargetIndex < 0) {
    firstFindTime = unavailableMetric(
      "milliseconds",
      "missing_target_acquired",
      "没有首次目标确认事件。",
      "从 trial_start 到首次人工标注 target_acquired 的时间。",
      [events[trialStartIndex].eventId],
    );
  } else {
    const trialStart = events[trialStartIndex];
    const firstTarget = events[firstTargetIndex];
    firstFindTime = availableMetric(
      firstTarget.timestampMs - trialStart.timestampMs,
      "milliseconds",
      "从 trial_start 到首次人工标注 target_acquired 的时间；它不是游戏正式“发现”事件。",
      [trialStart.eventId, firstTarget.eventId],
      1,
      firstTarget.type === "target_acquired"
        ? TARGET_CONFIDENCE_WEIGHT[firstTarget.confidence]
        : 1,
    );
  }

  const activeChaseIds = new Set<string>();
  const searchGaps: number[] = [];
  const searchGapEvidence: string[] = [];
  const searchGapConfidences: number[] = [];
  let pendingSearchStart: ChaseEndEvent | null = null;

  for (const event of events) {
    if (event.type === "chase_start") {
      if (activeChaseIds.size === 0 && pendingSearchStart !== null) {
        pendingSearchStart = null;
      }

      activeChaseIds.add(event.chaseId);
      continue;
    }

    if (event.type === "chase_end") {
      const closedKnownChase = activeChaseIds.delete(event.chaseId);

      if (!closedKnownChase || activeChaseIds.size > 0) {
        continue;
      }

      pendingSearchStart = event.censored ? null : event;
      continue;
    }

    if (
      event.type === "target_acquired" &&
      activeChaseIds.size === 0 &&
      pendingSearchStart !== null
    ) {
      const gap = event.timestampMs - pendingSearchStart.timestampMs;

      if (gap >= 0 && Number.isFinite(gap)) {
        searchGaps.push(gap);
        searchGapEvidence.push(pendingSearchStart.eventId, event.eventId);
        searchGapConfidences.push(TARGET_CONFIDENCE_WEIGHT[event.confidence]);
      }

      pendingSearchStart = null;
    }
  }

  const averageGap = mean(searchGaps);
  const averageSearchGap =
    averageGap === null
      ? unavailableMetric(
          "milliseconds",
          "insufficient_search_gap_samples",
          "没有形成完整的“追逐全部结束后，再次确认目标”样本。",
          "仅在所有并发追逐都结束后，计算到下一次 target_acquired 的空窗；删失追逐不进入样本。",
          searchGapEvidence,
        )
      : availableMetric(
          averageGap,
          "milliseconds",
          "所有并发追逐都结束后，到下一次 target_acquired 的平均空窗；删失追逐不进入样本。",
          searchGapEvidence,
          searchGaps.length,
          mean(searchGapConfidences) ?? 1,
        );

  const hooks = events
    .map((event, index) => ({ event, index }))
    .filter(
      (
        item,
      ): item is { event: HookCompletedEvent; index: number } =>
        item.event.type === "hook_completed" && item.event.isStandardHook,
    );
  const postHookGaps: number[] = [];
  const postHookEvidence: string[] = [];
  const postHookConfidences: number[] = [];

  for (const hook of hooks) {
    for (let index = hook.index + 1; index < events.length; index += 1) {
      const candidate = events[index];

      if (candidate.type === "target_acquired") {
        const gap = candidate.timestampMs - hook.event.timestampMs;

        if (gap >= 0 && Number.isFinite(gap)) {
          postHookGaps.push(gap);
          postHookEvidence.push(hook.event.eventId, candidate.eventId);
          postHookConfidences.push(TARGET_CONFIDENCE_WEIGHT[candidate.confidence]);
        }

        break;
      }

      if (
        candidate.type === "chase_start" ||
        candidate.type === "hook_completed"
      ) {
        break;
      }
    }
  }

  const averagePostHookGap = mean(postHookGaps);
  const averagePostHookTargetAcquisition =
    averagePostHookGap === null
      ? unavailableMetric(
          "milliseconds",
          "insufficient_post_hook_samples",
          "没有形成完整的“有效挂钩后，再次确认目标”样本。",
          "从每次有效普通挂钩完成到下一次 target_acquired；若先开始新追逐或再次挂钩，则该样本不可用。",
          postHookEvidence,
        )
      : availableMetric(
          averagePostHookGap,
          "milliseconds",
          "从有效普通挂钩完成到下一次 target_acquired 的平均时间，并与追逐结束后的再搜寻分开统计。",
          postHookEvidence,
          postHookGaps.length,
          mean(postHookConfidences) ?? 1,
        );

  return {
    firstFindTime,
    averageSearchGap,
    averagePostHookTargetAcquisition,
  };
}
