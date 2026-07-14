import type {
  GeneratorId,
  HookStage,
  MatchEvent,
  MatchLog,
  SurvivorId,
  ValidationIssue,
} from "./types";

interface IndexedEvent {
  event: MatchEvent;
  originalIndex: number;
}

interface SurvivorSemanticState {
  hookStage: HookStage;
  hookCount: number;
  hooked: boolean;
  carried: boolean;
  controller: "human" | "bot";
  resolved: boolean;
}

interface RegressionSemanticState {
  generatorId: GeneratorId;
  phase: "active" | "paused" | "stopped";
  originalIndex: number;
}

export interface SemanticValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

function issue(
  severity: "error" | "warning",
  code: string,
  message: string,
  originalIndex?: number,
): ValidationIssue {
  return {
    severity,
    code,
    path: originalIndex === undefined ? "$.events" : `$.events[${originalIndex}]`,
    message,
    ...(originalIndex === undefined ? {} : { eventIndex: originalIndex }),
  };
}

function getSurvivorId(event: MatchEvent): SurvivorId | null {
  return "survivorId" in event ? event.survivorId : null;
}

function getGeneratorId(event: MatchEvent): GeneratorId | null {
  return "generatorId" in event ? event.generatorId : null;
}

function sortedEvents(events: readonly MatchEvent[]): IndexedEvent[] {
  return events
    .map((event, originalIndex) => ({ event, originalIndex }))
    .sort((left, right) =>
      left.event.timestampMs - right.event.timestampMs ||
      left.event.eventOrder - right.event.eventOrder ||
      left.originalIndex - right.originalIndex,
    );
}

export function validateMatchSemantics(log: MatchLog): SemanticValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const events = sortedEvents(log.events);
  const first = events[0];
  const last = events.at(-1);
  const trialEnd = events.find(({ event }) => event.type === "trial_end");

  if (first?.event.type !== "trial_start") {
    errors.push(issue("error", "TRIAL_START_NOT_FIRST", "trial_start 必须是规范化顺序中的第一个事件。", first?.originalIndex));
  }

  if (last?.event.type !== "trial_end") {
    errors.push(issue("error", "TRIAL_END_NOT_LAST", "trial_end 必须是规范化顺序中的最后一个事件。", last?.originalIndex));
  }

  if (trialEnd?.event.type === "trial_end") {
    if (trialEnd.event.timestampMs !== log.durationMs) {
      errors.push(issue("error", "TRIAL_END_DURATION_MISMATCH", "trial_end 时间必须与 durationMs 一致。", trialEnd.originalIndex));
    }

    if (!trialEnd.event.normalEnd || trialEnd.event.reason === "abnormal") {
      errors.push(issue("error", "ABNORMAL_TRIAL_END_UNSUPPORTED", "第一版规则集不分析异常结束的对局。", trialEnd.originalIndex));
    }
  }

  const survivorStates = new Map<SurvivorId, SurvivorSemanticState>(
    log.survivors.map((survivorId) => [
      survivorId,
      { hookStage: 0, hookCount: 0, hooked: false, carried: false, controller: "human", resolved: false },
    ]),
  );
  const chaseStarts = new Map<string, { survivorId: SurvivorId; originalIndex: number }>();
  const closedChases = new Set<string>();
  const explicitChaseEnds = new Set(
    events
      .filter(({ event }) => event.type === "chase_end")
      .map(({ event }) => (event.type === "chase_end" ? event.chaseId : "")),
  );
  const regressions = new Map<string, RegressionSemanticState>();
  const completedGenerators = new Set<GeneratorId>();
  const blockedGenerators = new Set<GeneratorId>();
  const completionIndexes = new Set<number>();

  for (const { event, originalIndex } of events) {
    const survivorId = getSurvivorId(event);
    const survivorState = survivorId === null ? null : survivorStates.get(survivorId) ?? null;

    if (survivorState?.resolved && event.type !== "survivor_outcome") {
      errors.push(issue("error", "EVENT_AFTER_SURVIVOR_OUTCOME", `逃生者 ${survivorId} 已离场，不能再产生 ${event.type}。`, originalIndex));
      continue;
    }

    const generatorId = getGeneratorId(event);
    if (generatorId !== null && completedGenerators.has(generatorId)) {
      errors.push(issue("error", "GENERATOR_EVENT_AFTER_COMPLETION", `发电机 ${generatorId} 完成后不能再产生 ${event.type}。`, originalIndex));
      continue;
    }

    switch (event.type) {
      case "chase_start": {
        if (chaseStarts.has(event.chaseId)) {
          errors.push(issue("error", "CHASE_ID_REUSED", `chaseId ${event.chaseId} 已被使用。`, originalIndex));
          break;
        }
        chaseStarts.set(event.chaseId, { survivorId: event.survivorId, originalIndex });
        break;
      }

      case "chase_end": {
        const start = chaseStarts.get(event.chaseId);
        if (!start) {
          errors.push(issue("error", "CHASE_END_WITHOUT_START", `追逐 ${event.chaseId} 没有对应的 chase_start。`, originalIndex));
        } else if (closedChases.has(event.chaseId)) {
          errors.push(issue("error", "CHASE_END_DUPLICATED", `追逐 ${event.chaseId} 已经结束。`, originalIndex));
        } else if (start.survivorId !== event.survivorId) {
          errors.push(issue("error", "CHASE_SURVIVOR_MISMATCH", `追逐 ${event.chaseId} 的起止逃生者不一致。`, originalIndex));
        } else {
          closedChases.add(event.chaseId);
        }
        break;
      }

      case "survivor_downed": {
        for (const [chaseId, start] of chaseStarts) {
          if (
            start.survivorId === event.survivorId &&
            !closedChases.has(chaseId) &&
            !explicitChaseEnds.has(chaseId)
          ) {
            warnings.push(issue("warning", "CHASE_END_GENERATED_AT_DOWN", `追逐 ${chaseId} 在倒地时缺少 chase_end，将按原型策略补充结束事件。`, originalIndex));
            closedChases.add(chaseId);
          }
        }
        break;
      }

      case "hook_completed": {
        if (!survivorState) break;
        if (survivorState.hooked) {
          errors.push(issue("error", "HOOK_WHILE_ALREADY_HOOKED", `逃生者 ${event.survivorId} 已在钩上。`, originalIndex));
          break;
        }
        if (event.isStandardHook) {
          if (!survivorState.carried) {
            errors.push(issue("error", "HOOK_WITHOUT_PICKUP", `逃生者 ${event.survivorId} 缺少此前对应的抱起事件。`, originalIndex));
          }
          if (event.stageBefore !== survivorState.hookStage) {
            errors.push(issue("error", "HOOK_STAGE_MISMATCH", `逃生者 ${event.survivorId} 的 stageBefore 与此前挂钩阶段不一致。`, originalIndex));
          }
          if (event.hookNumber !== survivorState.hookCount + 1) {
            errors.push(issue("error", "HOOK_NUMBER_MISMATCH", `逃生者 ${event.survivorId} 的 hookNumber 不连续。`, originalIndex));
          }
          survivorState.hookStage = event.stageAfter;
          survivorState.hookCount += 1;
          survivorState.hooked = true;
          survivorState.carried = false;
        }
        break;
      }

      case "survivor_picked_up": {
        if (!survivorState) break;
        if (survivorState.carried || survivorState.hooked) {
          errors.push(issue("error", "PICKUP_STATE_INVALID", `逃生者 ${event.survivorId} 当前状态不能再次被抱起。`, originalIndex));
        } else {
          survivorState.carried = true;
        }
        break;
      }

      case "survivor_released": {
        if (!survivorState) break;
        if (!survivorState.carried) {
          errors.push(issue("error", "RELEASE_WITHOUT_PICKUP", `逃生者 ${event.survivorId} 未被抱起，不能产生释放事件。`, originalIndex));
        } else {
          survivorState.carried = false;
        }
        break;
      }

      case "hook_stage_advanced": {
        if (!survivorState) break;
        if (!survivorState.hooked || survivorState.hookStage !== event.fromStage) {
          errors.push(issue("error", "HOOK_STAGE_ADVANCE_INVALID", `逃生者 ${event.survivorId} 的自然进阶段与当前挂钩状态不一致。`, originalIndex));
        } else {
          survivorState.hookStage = event.toStage;
        }
        break;
      }

      case "survivor_unhooked": {
        if (!survivorState) break;
        if (
          event.rescuerId !== null &&
          survivorStates.get(event.rescuerId)?.resolved
        ) {
          errors.push(issue("error", "RESCUER_ALREADY_RESOLVED", `救援者 ${event.rescuerId} 已离场，不能完成救援。`, originalIndex));
        }
        if (!survivorState.hooked || survivorState.hookStage !== event.stageAtRelease) {
          errors.push(issue("error", "UNHOOK_STATE_INVALID", `逃生者 ${event.survivorId} 的离钩事件与当前挂钩状态不一致。`, originalIndex));
        } else {
          survivorState.hooked = false;
        }
        break;
      }

      case "controller_changed": {
        if (!survivorState) break;
        if (survivorState.controller !== event.from) {
          errors.push(issue("error", "CONTROLLER_TRANSITION_INVALID", `逃生者 ${event.survivorId} 的控制者转换不连续。`, originalIndex));
        } else {
          survivorState.controller = event.to;
        }
        break;
      }

      case "survivor_outcome": {
        if (!survivorState) break;
        if (survivorState.resolved) {
          errors.push(issue("error", "SURVIVOR_OUTCOME_DUPLICATED", `逃生者 ${event.survivorId} 已有离场结果。`, originalIndex));
        } else {
          survivorState.resolved = true;
        }
        break;
      }

      case "generator_regression_started": {
        const existing = regressions.get(event.regressionId);
        if (existing && existing.phase !== "stopped") {
          errors.push(issue("error", "REGRESSION_ID_REUSED", `回退区间 ${event.regressionId} 已经开始。`, originalIndex));
        } else if (existing) {
          errors.push(issue("error", "REGRESSION_ID_REUSED", `regressionId ${event.regressionId} 已被使用。`, originalIndex));
        } else {
          regressions.set(event.regressionId, {
            generatorId: event.generatorId,
            phase: "active",
            originalIndex,
          });
        }
        break;
      }

      case "generator_blocked": {
        if (blockedGenerators.has(event.generatorId)) {
          errors.push(issue("error", "GENERATOR_ALREADY_BLOCKED", `发电机 ${event.generatorId} 已处于封锁状态。`, originalIndex));
        } else {
          blockedGenerators.add(event.generatorId);
        }
        break;
      }

      case "generator_unblocked": {
        if (!blockedGenerators.has(event.generatorId)) {
          errors.push(issue("error", "GENERATOR_UNBLOCKED_WITHOUT_BLOCK", `发电机 ${event.generatorId} 未被封锁，不能解除封锁。`, originalIndex));
        } else {
          blockedGenerators.delete(event.generatorId);
        }
        break;
      }

      case "generator_repair_started": {
        if (blockedGenerators.has(event.generatorId)) {
          errors.push(issue("error", "REPAIR_STARTED_WHILE_BLOCKED", `发电机 ${event.generatorId} 处于封锁状态，不能开始修理。`, originalIndex));
        }
        break;
      }

      case "generator_regression_paused":
      case "generator_regression_resumed":
      case "generator_regression_stopped": {
        const regression = regressions.get(event.regressionId);
        const expectedPhase = event.type === "generator_regression_resumed" ? "paused" : "active";
        if (!regression) {
          errors.push(issue("error", "REGRESSION_EVENT_WITHOUT_START", `回退事件 ${event.regressionId} 没有对应的开始事件。`, originalIndex));
        } else if (regression.generatorId !== event.generatorId) {
          errors.push(issue("error", "REGRESSION_GENERATOR_MISMATCH", `回退区间 ${event.regressionId} 引用了不同发电机。`, originalIndex));
        } else if (event.type === "generator_regression_stopped") {
          if (regression.phase === "stopped") {
            errors.push(issue("error", "REGRESSION_ALREADY_STOPPED", `回退区间 ${event.regressionId} 已停止。`, originalIndex));
          } else {
            regression.phase = "stopped";
          }
        } else if (regression.phase !== expectedPhase) {
          errors.push(issue("error", "REGRESSION_TRANSITION_INVALID", `回退区间 ${event.regressionId} 的暂停或恢复顺序无效。`, originalIndex));
        } else {
          regression.phase = event.type === "generator_regression_paused" ? "paused" : "active";
        }
        break;
      }

      case "generator_completed": {
        const openRegression = [...regressions.values()].some(
          (regression) => regression.generatorId === event.generatorId && regression.phase !== "stopped",
        );
        if (openRegression) {
          errors.push(issue("error", "GENERATOR_COMPLETED_WITH_OPEN_REGRESSION", `发电机 ${event.generatorId} 完成前必须关闭其回退区间。`, originalIndex));
        }
        if (blockedGenerators.has(event.generatorId)) {
          errors.push(issue("error", "GENERATOR_COMPLETED_WHILE_BLOCKED", `发电机 ${event.generatorId} 处于封锁状态，不能完成。`, originalIndex));
        }
        for (const contributorId of event.contributors) {
          if (survivorStates.get(contributorId)?.resolved) {
            errors.push(issue("error", "RESOLVED_GENERATOR_CONTRIBUTOR", `逃生者 ${contributorId} 已离场，不能成为发电机完成贡献者。`, originalIndex));
          }
        }
        if (completionIndexes.has(event.completionIndex)) {
          errors.push(issue("error", "GENERATOR_COMPLETION_INDEX_DUPLICATED", `completionIndex ${event.completionIndex} 重复。`, originalIndex));
        }
        completionIndexes.add(event.completionIndex);
        completedGenerators.add(event.generatorId);
        break;
      }

      default:
        break;
    }
  }

  for (const [chaseId, start] of chaseStarts) {
    if (!closedChases.has(chaseId)) {
      warnings.push(issue("warning", "OPEN_CHASE_CENSORED_AT_TRIAL_END", `追逐 ${chaseId} 未结束，将在 trial_end 处生成 censored 结束事件。`, start.originalIndex));
    }
  }

  for (const [regressionId, regression] of regressions) {
    if (regression.phase !== "stopped") {
      warnings.push(issue("warning", "OPEN_REGRESSION_CENSORED_AT_TRIAL_END", `回退区间 ${regressionId} 未结束，将在 trial_end 处生成 censored 停止事件。`, regression.originalIndex));
    }
  }

  return { errors, warnings };
}
