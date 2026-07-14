import type {
  ChaseEndEvent,
  ChaseStartEvent,
  GeneratorRegressionStoppedEvent,
  MatchEvent,
  MatchLog,
  TrialEndEvent,
} from "./types";

function uniquePolicyEventId(base: string, usedIds: Set<string>): string {
  let candidate = base;
  let suffix = 2;
  while (usedIds.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  usedIds.add(candidate);
  return candidate;
}

export function normalizeMatchLog(log: MatchLog): MatchLog {
  const sortedEvents = log.events
    .map((event, originalIndex) => ({ event, originalIndex }))
    .sort((left, right) => {
      const timestampDifference =
        left.event.timestampMs - right.event.timestampMs;

      if (timestampDifference !== 0) {
        return timestampDifference;
      }

      const orderDifference = left.event.eventOrder - right.event.eventOrder;

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return left.originalIndex - right.originalIndex;
    })
    .map(({ event }) => event);

  const usedIds = new Set(sortedEvents.map((event) => event.eventId));
  const explicitChaseEnds = new Set(
    sortedEvents
      .filter((event): event is ChaseEndEvent => event.type === "chase_end")
      .map((event) => event.chaseId),
  );
  const activeChases = new Map<string, ChaseStartEvent>();
  const activeRegressions = new Map<
    string,
    { generatorId: string; progress: number }
  >();
  const normalized: MatchEvent[] = [];
  let trialEnd: TrialEndEvent | null = null;

  for (const event of sortedEvents) {
    if (event.type === "trial_end") {
      trialEnd = event;
      continue;
    }

    normalized.push(event);

    if (event.type === "chase_start") {
      activeChases.set(event.chaseId, event);
    } else if (event.type === "chase_end") {
      activeChases.delete(event.chaseId);
    } else if (event.type === "survivor_downed") {
      for (const [chaseId, start] of activeChases) {
        if (
          start.survivorId !== event.survivorId ||
          explicitChaseEnds.has(chaseId)
        ) {
          continue;
        }

        normalized.push({
          eventId: uniquePolicyEventId(`policy-chase-end-${chaseId}`, usedIds),
          timestampMs: event.timestampMs,
          eventOrder: event.eventOrder,
          type: "chase_end",
          chaseId,
          survivorId: start.survivorId,
          endReason: "target_downed",
          censored: false,
          policyGenerated: true,
        });
        activeChases.delete(chaseId);
      }
    }

    if (event.type === "generator_regression_started") {
      activeRegressions.set(event.regressionId, {
        generatorId: event.generatorId,
        progress: event.progress,
      });
    } else if (
      event.type === "generator_regression_paused" ||
      event.type === "generator_regression_resumed"
    ) {
      const active = activeRegressions.get(event.regressionId);
      if (active) active.progress = event.progress;
    } else if (event.type === "generator_regression_stopped") {
      activeRegressions.delete(event.regressionId);
    }

    const generatorId = "generatorId" in event ? event.generatorId : null;
    const observedProgress =
      event.type === "generator_progress_delta"
        ? event.progressAfter
        : "progress" in event && typeof event.progress === "number"
          ? event.progress
          : null;
    if (generatorId !== null && observedProgress !== null) {
      for (const regression of activeRegressions.values()) {
        if (regression.generatorId === generatorId) {
          regression.progress = observedProgress;
        }
      }
    }
  }

  if (trialEnd) {
    for (const [chaseId, start] of activeChases) {
      normalized.push({
        eventId: uniquePolicyEventId(`policy-chase-end-${chaseId}`, usedIds),
        timestampMs: trialEnd.timestampMs,
        eventOrder: trialEnd.eventOrder,
        type: "chase_end",
        chaseId,
        survivorId: start.survivorId,
        endReason: "trial_end",
        censored: true,
        policyGenerated: true,
      });
    }

    for (const [regressionId, regression] of activeRegressions) {
      const generatedStop: GeneratorRegressionStoppedEvent = {
        eventId: uniquePolicyEventId(`policy-regression-stop-${regressionId}`, usedIds),
        timestampMs: trialEnd.timestampMs,
        eventOrder: trialEnd.eventOrder,
        type: "generator_regression_stopped",
        regressionId,
        generatorId: regression.generatorId,
        progress: regression.progress,
        reason: "trial_end",
        censored: true,
        policyGenerated: true,
      };
      normalized.push(generatedStop);
    }

    normalized.push(trialEnd);
  }

  const events = normalized.map((event, eventOrder) => ({
    ...event,
    eventOrder,
  })) as MatchEvent[];

  return {
    ...log,
    survivors: [...log.survivors],
    generators: [...log.generators],
    unsupportedMechanics: [...log.unsupportedMechanics],
    events,
  };
}
