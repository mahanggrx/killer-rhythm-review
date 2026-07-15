import type { MatchLog } from "../log";
import { calculateChaseMetrics } from "./calculateChaseMetrics";
import { calculateEliminationMetrics } from "./calculateEliminationMetrics";
import { calculateEngagementMetrics } from "./calculateEngagementMetrics";
import { calculateGeneratorControlMetrics } from "./calculateGeneratorControlMetrics";
import { canonicalizeEvents } from "./shared";
import type { MatchMetrics, MetricConfig } from "./types";

export function calculateMatchMetrics(
  log: MatchLog,
  config: Readonly<MetricConfig>,
): MatchMetrics {
  const canonical = canonicalizeEvents(log.events);
  const generatorCalculation = calculateGeneratorControlMetrics(
    canonical.events,
    config.highProgressThreshold,
  );

  return {
    engagement: calculateEngagementMetrics(canonical.events),
    chase: calculateChaseMetrics(canonical.events),
    generatorControl: generatorCalculation.metrics,
    elimination: calculateEliminationMetrics(canonical.events),
    diagnostics: [
      ...canonical.diagnostics,
      ...generatorCalculation.diagnostics,
    ],
  };
}
