import type { MatchLog } from "./types";

export function normalizeMatchLog(log: MatchLog): MatchLog {
  const events = log.events
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

  return {
    ...log,
    survivors: [...log.survivors],
    generators: [...log.generators],
    unsupportedMechanics: [...log.unsupportedMechanics],
    events,
  };
}

