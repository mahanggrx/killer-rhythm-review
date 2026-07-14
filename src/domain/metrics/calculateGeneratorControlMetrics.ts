import type {
  GeneratorBlockedEvent,
  GeneratorProgressDeltaEvent,
  GeneratorRegressionStartedEvent,
  MatchEvent,
} from "../log";
import { availableMetric, unavailableMetric } from "./shared";
import type {
  GeneratorControlMetrics,
  MetricDiagnostic,
} from "./types";

type EffectiveProgressDeltaEvent = GeneratorProgressDeltaEvent & {
  interferenceId: string;
};

type EffectiveInterferenceEvent =
  | EffectiveProgressDeltaEvent
  | GeneratorRegressionStartedEvent
  | GeneratorBlockedEvent;

interface HighProgressEpisode {
  startEventId: string;
  interfered: boolean;
}

interface GeneratorProgressState {
  lastProgress: number | null;
  episode: HighProgressEpisode | null;
  completed: boolean;
}

interface GeneratorMetricCalculation {
  metrics: GeneratorControlMetrics;
  diagnostics: MetricDiagnostic[];
}

function isEffectiveInterference(
  event: MatchEvent,
): event is EffectiveInterferenceEvent {
  if (event.type === "generator_progress_delta") {
    return (
      event.applied &&
      event.killerCaused &&
      event.delta < 0 &&
      typeof event.interferenceId === "string"
    );
  }

  return (
    event.type === "generator_regression_started" ||
    event.type === "generator_blocked"
  );
}

function getInterferenceProgress(event: EffectiveInterferenceEvent): number {
  return event.type === "generator_progress_delta"
    ? event.progressBefore
    : event.progress;
}

function getObservedProgress(event: MatchEvent): number | null {
  switch (event.type) {
    case "generator_repair_started":
    case "generator_repair_stopped":
    case "generator_regression_started":
    case "generator_regression_paused":
    case "generator_regression_resumed":
    case "generator_regression_stopped":
    case "generator_blocked":
    case "generator_unblocked":
      return event.progress;
    case "generator_progress_delta":
      return event.applied ? event.progressAfter : event.progressBefore;
    default:
      return null;
  }
}

function getGeneratorId(event: MatchEvent): string | null {
  return "generatorId" in event ? event.generatorId : null;
}

export function calculateGeneratorControlMetrics(
  events: readonly MatchEvent[],
  highProgressThreshold: number,
): GeneratorMetricCalculation {
  const explanationSuffix =
    "高进度阈值由配置传入，达到阈值即视为进入高进度区间；该数值为原型待验证数值。";

  if (
    !Number.isFinite(highProgressThreshold) ||
    highProgressThreshold < 0 ||
    highProgressThreshold > 1
  ) {
    const metrics: GeneratorControlMetrics = {
      highProgressGeneratorLosses: unavailableMetric(
        "count",
        "invalid_high_progress_threshold",
        "高进度阈值必须是 0 到 1 之间的有限数值。",
        `进入高进度 episode 后，在下一次有效杀手干扰前完成的发电机数量。${explanationSuffix}`,
      ),
      keyGeneratorInterruptions: unavailableMetric(
        "count",
        "invalid_high_progress_threshold",
        "高进度阈值必须是 0 到 1 之间的有限数值。",
        `高进度状态下发生的有效杀手干扰次数，按 interferenceId 去重。${explanationSuffix}`,
      ),
    };

    return {
      metrics,
      diagnostics: [
        {
          severity: "error",
          code: "invalid_metric_config",
          message: "highProgressThreshold 必须是 0 到 1 之间的有限数值。",
          evidenceEventIds: [],
        },
      ],
    };
  }

  const progressEvidenceEvents = events.filter(
    (event) =>
      getGeneratorId(event) !== null &&
      event.type !== "generator_completed" &&
      getObservedProgress(event) !== null,
  );

  if (progressEvidenceEvents.length === 0) {
    const metrics: GeneratorControlMetrics = {
      highProgressGeneratorLosses: unavailableMetric(
        "count",
        "no_generator_progress_evidence",
        "没有完成事件之前的发电机进度证据，无法重建高进度 episode。",
        `进入高进度 episode 后，在下一次有效杀手干扰前完成的发电机数量。${explanationSuffix}`,
      ),
      keyGeneratorInterruptions: unavailableMetric(
        "count",
        "no_generator_progress_evidence",
        "没有发电机进度或干扰证据。",
        `高进度状态下发生的有效杀手干扰次数，按 interferenceId 去重。${explanationSuffix}`,
      ),
    };

    return { metrics, diagnostics: [] };
  }

  const qualifyingInterferences = new Map<string, string[]>();

  for (const event of events) {
    if (
      !isEffectiveInterference(event) ||
      getInterferenceProgress(event) < highProgressThreshold
    ) {
      continue;
    }

    const evidence = qualifyingInterferences.get(event.interferenceId) ?? [];
    evidence.push(event.eventId);
    qualifyingInterferences.set(event.interferenceId, evidence);
  }

  const states = new Map<string, GeneratorProgressState>();
  const lostGeneratorIds = new Set<string>();
  const lossEvidenceIds: string[] = [];

  const getState = (generatorId: string): GeneratorProgressState => {
    const existing = states.get(generatorId);

    if (existing) {
      return existing;
    }

    const created: GeneratorProgressState = {
      lastProgress: null,
      episode: null,
      completed: false,
    };
    states.set(generatorId, created);
    return created;
  };

  for (const event of events) {
    const generatorId = getGeneratorId(event);

    if (generatorId === null) {
      continue;
    }

    const state = getState(generatorId);

    if (state.completed) {
      continue;
    }

    if (event.type === "generator_completed") {
      if (
        state.episode !== null &&
        !state.episode.interfered &&
        state.lastProgress !== null &&
        state.lastProgress >= highProgressThreshold
      ) {
        lostGeneratorIds.add(generatorId);
        lossEvidenceIds.push(state.episode.startEventId, event.eventId);
      }

      state.completed = true;
      state.lastProgress = 1;
      state.episode = null;
      continue;
    }

    const interferenceProgress = isEffectiveInterference(event)
      ? getInterferenceProgress(event)
      : null;

    if (
      interferenceProgress !== null &&
      interferenceProgress >= highProgressThreshold &&
      state.episode === null
    ) {
      state.episode = {
        startEventId: event.eventId,
        interfered: false,
      };
    }

    if (
      isEffectiveInterference(event) &&
      state.episode !== null &&
      interferenceProgress !== null &&
      interferenceProgress >= highProgressThreshold
    ) {
      state.episode.interfered = true;
    }

    const observedProgress = getObservedProgress(event);

    if (observedProgress === null) {
      continue;
    }

    if (
      observedProgress >= highProgressThreshold &&
      state.episode === null
    ) {
      state.episode = {
        startEventId: event.eventId,
        interfered: false,
      };
    } else if (observedProgress < highProgressThreshold) {
      state.episode = null;
    }

    state.lastProgress = observedProgress;
  }

  const interruptionEvidenceIds = [...qualifyingInterferences.values()].flat();
  const metrics: GeneratorControlMetrics = {
    highProgressGeneratorLosses: availableMetric(
      lostGeneratorIds.size,
      "count",
      `进入高进度 episode 后，在下一次有效杀手干扰前完成的不同发电机数量；允许同一台发电机多次跨越阈值。${explanationSuffix}`,
      lossEvidenceIds,
      lostGeneratorIds.size,
    ),
    keyGeneratorInterruptions: availableMetric(
      qualifyingInterferences.size,
      "count",
      `仅统计实际生效的杀手即时损失、回退开始或封锁；以干扰前进度判断高进度，并按 interferenceId 去重。${explanationSuffix}`,
      interruptionEvidenceIds,
      qualifyingInterferences.size,
    ),
  };

  return { metrics, diagnostics: [] };
}
