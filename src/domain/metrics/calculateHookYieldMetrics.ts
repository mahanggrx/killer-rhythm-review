import type {
  HookCompletedEvent,
  MatchEvent,
  SurvivorOutcomeEvent,
  SurvivorUnhookedEvent,
} from "../log";
import { availableMetric, unavailableMetric } from "./shared";
import type { HookYieldMetrics } from "./types";

interface HookConversionState {
  firstHook: HookCompletedEvent | null;
  firstUnhookAfterFirstHook: SurvivorUnhookedEvent | null;
  converted: boolean;
}

const PERMANENT_ELIMINATION_OUTCOMES = new Set([
  "sacrificed",
  "killed",
  "bled_out",
]);

export function calculateHookYieldMetrics(
  events: readonly MatchEvent[],
): HookYieldMetrics {
  const standardHooks = events.filter(
    (event): event is HookCompletedEvent =>
      event.type === "hook_completed" && event.isStandardHook,
  );
  const uniqueSurvivorIds = new Set(
    standardHooks.map((event) => event.survivorId),
  );

  const totalHooks = availableMetric(
    standardHooks.length,
    "count",
    "有效普通 hook_completed 的总数；自然进入下一挂钩阶段不计为新的挂钩。",
    standardHooks.map((event) => event.eventId),
    standardHooks.length,
  );
  const uniqueSurvivorsHooked = availableMetric(
    uniqueSurvivorIds.size,
    "count",
    "至少发生过一次有效普通挂钩的不同逃生者数量。",
    standardHooks.map((event) => event.eventId),
    uniqueSurvivorIds.size,
  );

  const conversionStates = new Map<string, HookConversionState>();
  const conversionEvidenceIds: string[] = [];
  let conversionCount = 0;

  const getConversionState = (survivorId: string): HookConversionState => {
    const existing = conversionStates.get(survivorId);

    if (existing) {
      return existing;
    }

    const created: HookConversionState = {
      firstHook: null,
      firstUnhookAfterFirstHook: null,
      converted: false,
    };
    conversionStates.set(survivorId, created);
    return created;
  };

  for (const event of events) {
    if (event.type === "hook_completed" && event.isStandardHook) {
      const state = getConversionState(event.survivorId);

      if (state.firstHook === null) {
        state.firstHook = event;
      } else if (
        state.firstUnhookAfterFirstHook !== null &&
        !state.converted
      ) {
        state.converted = true;
        conversionCount += 1;
        conversionEvidenceIds.push(
          state.firstHook.eventId,
          state.firstUnhookAfterFirstHook.eventId,
          event.eventId,
        );
      }

      continue;
    }

    if (event.type === "survivor_unhooked") {
      const state = getConversionState(event.survivorId);

      if (
        state.firstHook !== null &&
        state.firstUnhookAfterFirstHook === null &&
        !state.converted
      ) {
        state.firstUnhookAfterFirstHook = event;
      }
    }
  }

  const secondHookConversions = availableMetric(
    conversionCount,
    "count",
    "首次有效普通挂钩后成功离钩，并在其后再次有效上钩的逃生者数量；同一次挂钩自然进阶段不算转化。",
    conversionEvidenceIds,
    conversionCount,
  );

  const trialStart = events.find((event) => event.type === "trial_start");
  const firstElimination = events.find(
    (event) =>
      event.type === "survivor_outcome" &&
      PERMANENT_ELIMINATION_OUTCOMES.has(event.outcomeType),
  );

  let firstEliminationTime: HookYieldMetrics["firstEliminationTime"];

  if (!trialStart) {
    firstEliminationTime = unavailableMetric(
      "milliseconds",
      "missing_trial_start",
      "缺少对局开始事件，无法确定首次永久减员的计时起点。",
      "从 trial_start 到首次献祭、处决或流血死亡的时间；逃脱和 BOT 接管不算减员。",
    );
  } else if (!firstElimination) {
    firstEliminationTime = unavailableMetric(
      "milliseconds",
      "no_elimination_event",
      "本局没有永久减员事件。",
      "从 trial_start 到首次献祭、处决或流血死亡的时间；逃脱和 BOT 接管不算减员。",
      [trialStart.eventId],
    );
  } else {
    firstEliminationTime = availableMetric(
      firstElimination.timestampMs - trialStart.timestampMs,
      "milliseconds",
      "从 trial_start 到首次永久减员；献祭、处决和流血死亡均可计入，但不把 BOT 接管视作减员。",
      [trialStart.eventId, firstElimination.eventId],
      1,
    );
  }

  let hookChainElimination: SurvivorOutcomeEvent | null = null;
  let supportingHook: HookCompletedEvent | null = null;

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];

    if (
      event.type !== "survivor_outcome" ||
      event.outcomeType !== "sacrificed"
    ) {
      continue;
    }

    const precedingHook = events
      .slice(0, index)
      .reverse()
      .find(
        (candidate): candidate is HookCompletedEvent =>
          candidate.type === "hook_completed" &&
          candidate.isStandardHook &&
          candidate.survivorId === event.survivorId,
      );

    if (precedingHook) {
      hookChainElimination = event;
      supportingHook = precedingHook;
      break;
    }
  }
  let firstHookChainEliminationTime: HookYieldMetrics["firstHookChainEliminationTime"];

  if (!trialStart) {
    firstHookChainEliminationTime = unavailableMetric(
      "milliseconds",
      "missing_trial_start",
      "缺少对局开始事件，无法确定普通挂钩链减员时间。",
      "从 trial_start 到首次有普通挂钩证据支持的 sacrificed 结果；与处决和流血死亡分开。",
    );
  } else if (!hookChainElimination) {
    firstHookChainEliminationTime = unavailableMetric(
      "milliseconds",
      "no_hook_chain_elimination",
      "没有普通挂钩链导致献祭的可用证据。",
      "从 trial_start 到首次有普通挂钩证据支持的 sacrificed 结果；与处决和流血死亡分开。",
      standardHooks.map((hook) => hook.eventId),
    );
  } else {
    firstHookChainEliminationTime = availableMetric(
      hookChainElimination.timestampMs - trialStart.timestampMs,
      "milliseconds",
      "从 trial_start 到首次普通挂钩链献祭；处决和流血死亡不会计入此指标。",
      [
        trialStart.eventId,
        ...(supportingHook ? [supportingHook.eventId] : []),
        hookChainElimination.eventId,
      ],
      1,
    );
  }

  let hookConcentration: HookYieldMetrics["hookConcentration"];

  if (standardHooks.length === 0) {
    hookConcentration = unavailableMetric(
      "ratio",
      "no_hooks_for_concentration",
      "没有有效普通挂钩，最高个人挂数除以总挂数的分母为零。",
      "最高单个逃生者的有效普通挂钩数除以总有效普通挂钩数。",
    );
  } else {
    const hookCounts = new Map<string, number>();

    for (const hook of standardHooks) {
      hookCounts.set(
        hook.survivorId,
        (hookCounts.get(hook.survivorId) ?? 0) + 1,
      );
    }

    const highestHookCount = Math.max(...hookCounts.values());
    hookConcentration = availableMetric(
      highestHookCount / standardHooks.length,
      "ratio",
      "最高单个逃生者的有效普通挂钩数除以总有效普通挂钩数；仅描述本局挂钩分布，不评价打法对错。",
      standardHooks.map((hook) => hook.eventId),
      standardHooks.length,
    );
  }

  return {
    totalHooks,
    uniqueSurvivorsHooked,
    secondHookConversions,
    firstEliminationTime,
    firstHookChainEliminationTime,
    hookConcentration,
  };
}
