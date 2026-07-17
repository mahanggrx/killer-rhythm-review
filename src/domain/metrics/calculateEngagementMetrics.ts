import type { ChaseEndEvent, MatchEvent } from "../log";
import { availableMetric, mean, unavailableMetric } from "./shared";
import type { EngagementMetrics } from "./types";

export function calculateEngagementMetrics(
  events: readonly MatchEvent[],
): EngagementMetrics {
  const trialStartIndex = events.findIndex(
    (event) => event.type === "trial_start",
  );
  const firstChaseIndex = events.findIndex(
    (event, index) => index > trialStartIndex && event.type === "chase_start",
  );

  if (trialStartIndex < 0) {
    return {
      firstChaseStartTime: unavailableMetric(
        "milliseconds",
        "missing_trial_start",
        "缺少对局开始事件，无法确定首次进入追逐的计时起点。",
        "首次进入追逐时间从 trial_start 计算到第一条游戏正式 chase_start。",
      ),
      averageChaseGap: unavailableMetric(
        "milliseconds",
        "missing_trial_start",
        "缺少对局开始事件，无法确定首个追逐空窗的计时起点。",
        "平均追逐空窗包含对局开始到首次 chase_start，以及全部追逐结束后到下一次 chase_start 的完整空窗。",
      ),
    };
  }

  if (firstChaseIndex < 0) {
    return {
      firstChaseStartTime: unavailableMetric(
        "milliseconds",
        "missing_chase_start",
        "本局没有游戏正式追逐开始事件，无法计算首次进入追逐时间。",
        "首次进入追逐时间从 trial_start 计算到第一条游戏正式 chase_start。",
        [events[trialStartIndex].eventId],
      ),
      averageChaseGap: unavailableMetric(
        "milliseconds",
        "missing_chase_start",
        "本局没有游戏正式追逐开始事件，无法形成追逐空窗样本。",
        "平均追逐空窗包含对局开始到首次 chase_start，以及全部追逐结束后到下一次 chase_start 的完整空窗。",
        [events[trialStartIndex].eventId],
      ),
    };
  }

  const trialStart = events[trialStartIndex];
  const firstChase = events[firstChaseIndex];
  const gaps: number[] = [];
  const evidenceEventIds: string[] = [];
  const openingGap = firstChase.timestampMs - trialStart.timestampMs;

  if (Number.isFinite(openingGap) && openingGap >= 0) {
    gaps.push(openingGap);
    evidenceEventIds.push(trialStart.eventId, firstChase.eventId);
  }

  const activeChaseIds = new Set<string>();
  let pendingGapStart: ChaseEndEvent | null = null;

  for (const event of events) {
    if (event.type === "chase_start") {
      if (activeChaseIds.size === 0 && pendingGapStart !== null) {
        const gap = event.timestampMs - pendingGapStart.timestampMs;

        if (Number.isFinite(gap) && gap >= 0) {
          gaps.push(gap);
          evidenceEventIds.push(pendingGapStart.eventId, event.eventId);
        }

        pendingGapStart = null;
      }

      activeChaseIds.add(event.chaseId);
      continue;
    }

    if (event.type !== "chase_end") {
      continue;
    }

    const closedKnownChase = activeChaseIds.delete(event.chaseId);

    if (!closedKnownChase || activeChaseIds.size > 0) {
      continue;
    }

    pendingGapStart = event.censored ? null : event;
  }

  const averageGap = mean(gaps);

  return {
    firstChaseStartTime: availableMetric(
      openingGap,
      "milliseconds",
      "从对局开始 trial_start 到第一条游戏正式 chase_start 的时间；该指标表示首次建立正式追逐压力的时间，不等同于玩家主观发现目标的准确时刻。",
      [trialStart.eventId, firstChase.eventId],
      1,
    ),
    averageChaseGap: averageGap === null
      ? unavailableMetric(
          "milliseconds",
          "missing_chase_start",
          "没有形成可用的追逐空窗样本。",
          "平均追逐空窗包含对局开始到首次 chase_start，以及全部追逐结束后到下一次 chase_start 的完整空窗。",
          evidenceEventIds,
        )
      : availableMetric(
          averageGap,
          "milliseconds",
          "对局开始到首次游戏正式 chase_start，与每次全部追逐结束后到下一次 chase_start 的完整空窗平均值；并发追逐未全部结束时不开始新空窗，删失结束和对局结束后的尾段不计入。",
          evidenceEventIds,
          gaps.length,
        ),
  };
}
