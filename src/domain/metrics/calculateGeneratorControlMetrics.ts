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
        "高进度发电机达到配置阈值后，未被控机即修开的数量。控机指杀手行为实际造成即时掉进度、开始回退或封锁。",
      ),
      keyGeneratorInterruptions: unavailableMetric(
        "count",
        "invalid_high_progress_threshold",
        "高进度阈值必须是 0 到 1 之间的有限数值。",
        "对达到配置阈值的高进度发电机的控机次数，按 interferenceId 去重。控机指杀手行为实际造成即时掉进度、开始回退或封锁。",
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

  const thresholdLabel = `${Number(
    (highProgressThreshold * 100).toFixed(2),
  )}%`;
  const explanationSuffix =
    `“控机”指杀手行为实际造成发电机即时掉进度、开始回退或封锁。本次计算使用进度 ≥ ${thresholdLabel} 的包含边界；该阈值为原型待验证数值。`;

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
        `日志没有记录发电机完成前的阶段进度，无法判断它是否达到 ${thresholdLabel}，也无法判断完成前是否被控机；这不代表数量为 0。`,
        `高进度发电机达到 ${thresholdLabel} 后，未被控机即修开的数量。${explanationSuffix}`,
      ),
      keyGeneratorInterruptions: unavailableMetric(
        "count",
        "no_generator_progress_evidence",
        `日志没有发电机阶段进度或杀手控机证据，不能判断对进度达到 ${thresholdLabel} 的高进度发电机的控机次数；这不代表次数为 0。`,
        `对进度达到 ${thresholdLabel} 的高进度发电机的控机次数，按 interferenceId 去重。${explanationSuffix}`,
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
  let highProgressEpisodeCount = 0;

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
      highProgressEpisodeCount += 1;
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
      highProgressEpisodeCount += 1;
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
      `统计达到 ${thresholdLabel} 后、未被控机即修开的不同高进度发电机；同一台电机最多计 1 台。${explanationSuffix}`,
      lossEvidenceIds,
      highProgressEpisodeCount,
    ),
    keyGeneratorInterruptions: availableMetric(
      qualifyingInterferences.size,
      "count",
      `只统计对进度达到 ${thresholdLabel} 的高进度发电机确实生效的控机；逃生者自行停修不计，同一次行为的多个效果按 interferenceId 合并为 1 次。${explanationSuffix}`,
      interruptionEvidenceIds,
      qualifyingInterferences.size,
    ),
  };

  return { metrics, diagnostics: [] };
}
