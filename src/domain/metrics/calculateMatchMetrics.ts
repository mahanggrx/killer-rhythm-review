import type { MatchLog } from "../log";
import { calculateChaseMetrics } from "./calculateChaseMetrics";
import { calculateFindingMetrics } from "./calculateFindingMetrics";
import { calculateGeneratorControlMetrics } from "./calculateGeneratorControlMetrics";
import { calculateHookYieldMetrics } from "./calculateHookYieldMetrics";
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
    finding: calculateFindingMetrics(canonical.events),
    chase: calculateChaseMetrics(canonical.events),
    generatorControl: generatorCalculation.metrics,
    hookYield: calculateHookYieldMetrics(canonical.events),
    diagnostics: [
      ...canonical.diagnostics,
      ...generatorCalculation.diagnostics,
    ],
  };
}
