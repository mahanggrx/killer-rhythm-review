import type { MatchEvent, SurvivorOutcomeEvent } from "../log";
import { availableMetric, unavailableMetric } from "./shared";
import type { EliminationMetrics } from "./types";

const REQUIRED_GENERATOR_COMPLETIONS = 5;
const PERMANENT_ELIMINATION_OUTCOMES = new Set<
  SurvivorOutcomeEvent["outcomeType"]
>(["sacrificed", "killed", "bled_out"]);

function isPermanentElimination(
  event: MatchEvent,
): event is SurvivorOutcomeEvent {
  return event.type === "survivor_outcome"
    && PERMANENT_ELIMINATION_OUTCOMES.has(event.outcomeType);
}

export function calculateEliminationMetrics(
  events: readonly MatchEvent[],
): EliminationMetrics {
  const trialEnd = events.find((event) => event.type === "trial_end");
  const eliminations = events.filter(isPermanentElimination);
  const firstEliminationIndex = events.findIndex(isPermanentElimination);
  const firstElimination = firstEliminationIndex >= 0
    ? events[firstEliminationIndex]
    : null;

  const totalEliminations = !trialEnd || !trialEnd.normalEnd
    ? unavailableMetric(
        "count",
        "abnormal_trial_end",
        "对局没有正常结束，不能把当前记录视为完整的最终减员结果。",
        "正常结束的完整对局中，献祭、处决和流血死亡均计为永久减员；逃脱和 BOT 接管不计入。",
        eliminations.map((event) => event.eventId),
      )
    : availableMetric(
        eliminations.length,
        "count",
        "正常结束的完整对局中，献祭、处决和流血死亡均计为永久减员；逃脱和 BOT 接管不计入。",
        [...eliminations.map((event) => event.eventId), trialEnd.eventId],
        1,
      );

  if (!firstElimination || firstElimination.type !== "survivor_outcome") {
    return {
      firstEliminationGeneratorsRemaining: unavailableMetric(
        "count",
        "no_elimination_event",
        trialEnd?.normalEnd
          ? "本局正常结束，但没有形成永久减员。"
          : "当前日志没有可验证的首次永久减员。",
        "首次献祭、处决或流血死亡发生前，尚未完成的基础修理目标数量；基础 1v4 规则需要完成 5 台发电机。",
        trialEnd ? [trialEnd.eventId] : [],
      ),
      totalEliminations,
    };
  }

  const completedBeforeElimination = events
    .slice(0, firstEliminationIndex)
    .filter((event) => event.type === "generator_completed");
  const uniqueCompletedGeneratorIds = new Set(
    completedBeforeElimination.map((event) => event.generatorId),
  );
  const remaining = Math.max(
    0,
    REQUIRED_GENERATOR_COMPLETIONS - uniqueCompletedGeneratorIds.size,
  );

  return {
    firstEliminationGeneratorsRemaining: availableMetric(
      remaining,
      "count",
      "首次献祭、处决或流血死亡发生前，基础 1v4 所需的 5 个发电机修理目标中尚未完成的数量；同时间戳使用 eventOrder 判断严格先后。",
      [
        ...completedBeforeElimination.map((event) => event.eventId),
        firstElimination.eventId,
      ],
      1,
    ),
    totalEliminations,
  };
}
