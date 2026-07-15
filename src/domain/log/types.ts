export const SUPPORTED_SCHEMA_VERSION = "1.0" as const;
export const SUPPORTED_RULESET = "base_only_1v4_10.0.2" as const;
export const SUPPORTED_PATCH = "10.0.2" as const;

export const SUPPORTED_EVENT_TYPES = [
  "trial_start",
  "chase_start",
  "chase_end",
  "survivor_injured",
  "survivor_downed",
  "survivor_picked_up",
  "survivor_released",
  "hook_completed",
  "hook_stage_advanced",
  "survivor_unhooked",
  "generator_repair_started",
  "generator_repair_stopped",
  "generator_progress_delta",
  "generator_regression_started",
  "generator_regression_paused",
  "generator_regression_resumed",
  "generator_regression_stopped",
  "generator_blocked",
  "generator_unblocked",
  "generator_completed",
  "survivor_outcome",
  "controller_changed",
  "trial_end",
] as const;

export type MatchEventType = (typeof SUPPORTED_EVENT_TYPES)[number];
export type SupportedSchemaVersion = typeof SUPPORTED_SCHEMA_VERSION;
export type SupportedRuleset = typeof SUPPORTED_RULESET;
export type SupportedPatch = typeof SUPPORTED_PATCH;

export type EventId = string;
export type SurvivorId = string;
export type GeneratorId = string;
export type ChaseId = string;
export type RegressionId = string;
export type InterferenceId = string;
export type Milliseconds = number;
export type ProgressRatio = number;

export type HealthState = "healthy" | "injured" | "dying";
export type CustodyState = "free" | "carried" | "hooked";
export type ControllerType = "human" | "bot";
export type HookStage = 0 | 1 | 2;
export type SurvivorOutcome =
  | "sacrificed"
  | "killed"
  | "bled_out"
  | "escaped";

export type ChaseEndReason =
  | "lost_los"
  | "range_break"
  | "locker"
  | "target_downed"
  | "target_switch"
  | "trial_end"
  | "unknown";

export interface BaseMatchEvent<TType extends MatchEventType> {
  eventId: EventId;
  timestampMs: Milliseconds;
  eventOrder: number;
  type: TType;
}

export type TrialStartEvent = BaseMatchEvent<"trial_start">;

export interface ChaseStartEvent extends BaseMatchEvent<"chase_start"> {
  chaseId: ChaseId;
  survivorId: SurvivorId;
  source: "game_state";
}

export interface ChaseEndEvent extends BaseMatchEvent<"chase_end"> {
  chaseId: ChaseId;
  survivorId: SurvivorId;
  endReason: ChaseEndReason;
  censored: boolean;
  policyGenerated: boolean;
}

export interface SurvivorInjuredEvent
  extends BaseMatchEvent<"survivor_injured"> {
  survivorId: SurvivorId;
  fromState: "healthy";
  cause: string;
  sourceId?: string;
}

export interface SurvivorDownedEvent
  extends BaseMatchEvent<"survivor_downed"> {
  survivorId: SurvivorId;
  fromState: "healthy" | "injured";
  cause: string;
  attribution: "killer" | "survivor" | "system" | "unknown";
  sourceId?: string;
}

export interface SurvivorPickedUpEvent
  extends BaseMatchEvent<"survivor_picked_up"> {
  survivorId: SurvivorId;
  priorHealthState: HealthState;
  pickupMethod: "ground" | "interaction_grab";
}

export interface SurvivorReleasedEvent
  extends BaseMatchEvent<"survivor_released"> {
  survivorId: SurvivorId;
  reason:
    | "killer_drop"
    | "wiggle"
    | "stun_save"
    | "blind_save"
    | "other";
}

export interface HookCompletedEvent extends BaseMatchEvent<"hook_completed"> {
  survivorId: SurvivorId;
  hookId: string;
  stageBefore: HookStage;
  stageAfter: HookStage;
  hookNumber: number;
  isDeathHook: boolean;
  isStandardHook: boolean;
}

export interface HookStageAdvancedEvent
  extends BaseMatchEvent<"hook_stage_advanced"> {
  survivorId: SurvivorId;
  fromStage: 1 | 2;
  toStage: 2;
  cause: "timer" | "other";
}

export interface SurvivorUnhookedEvent
  extends BaseMatchEvent<"survivor_unhooked"> {
  survivorId: SurvivorId;
  rescuerId: SurvivorId | null;
  method: "rescued" | "self_unhook" | "anti_camp" | "other";
  stageAtRelease: 1 | 2;
}

export interface GeneratorRepairStartedEvent
  extends BaseMatchEvent<"generator_repair_started"> {
  generatorId: GeneratorId;
  survivorId: SurvivorId;
  progress: ProgressRatio;
}

export interface GeneratorRepairStoppedEvent
  extends BaseMatchEvent<"generator_repair_stopped"> {
  generatorId: GeneratorId;
  survivorId: SurvivorId;
  progress: ProgressRatio;
  reason: "voluntary" | "forced_off" | "injured" | "downed" | "other";
}

export interface GeneratorProgressDeltaEvent
  extends BaseMatchEvent<"generator_progress_delta"> {
  generatorId: GeneratorId;
  delta: number;
  progressBefore: ProgressRatio;
  progressAfter: ProgressRatio;
  cause: string;
  sourceId?: string;
  applied: boolean;
  killerCaused: boolean;
  interferenceId?: InterferenceId;
}

export interface GeneratorRegressionStartedEvent
  extends BaseMatchEvent<"generator_regression_started"> {
  regressionId: RegressionId;
  interferenceId: InterferenceId;
  generatorId: GeneratorId;
  progress: ProgressRatio;
  source: string;
  regressionEventIndex: number;
}

export interface GeneratorRegressionPausedEvent
  extends BaseMatchEvent<"generator_regression_paused"> {
  regressionId: RegressionId;
  generatorId: GeneratorId;
  progress: ProgressRatio;
  reason: "repairing" | "blocked";
}

export interface GeneratorRegressionResumedEvent
  extends BaseMatchEvent<"generator_regression_resumed"> {
  regressionId: RegressionId;
  generatorId: GeneratorId;
  progress: ProgressRatio;
  reason: "repair_ended" | "unblocked";
}

export interface GeneratorRegressionStoppedEvent
  extends BaseMatchEvent<"generator_regression_stopped"> {
  regressionId: RegressionId;
  generatorId: GeneratorId;
  progress: ProgressRatio;
  reason: "repaired_5_percent" | "zero" | "completed" | "trial_end";
  censored: boolean;
  policyGenerated?: boolean;
}

export interface GeneratorBlockedEvent
  extends BaseMatchEvent<"generator_blocked"> {
  generatorId: GeneratorId;
  interferenceId: InterferenceId;
  progress: ProgressRatio;
  source: string;
  durationExpectedMs?: Milliseconds;
}

export interface GeneratorUnblockedEvent
  extends BaseMatchEvent<"generator_unblocked"> {
  generatorId: GeneratorId;
  progress: ProgressRatio;
  source: string;
}

export interface GeneratorCompletedEvent
  extends BaseMatchEvent<"generator_completed"> {
  generatorId: GeneratorId;
  completionIndex: number;
  progress: 1;
  contributors: SurvivorId[];
}

export interface SurvivorOutcomeEvent
  extends BaseMatchEvent<"survivor_outcome"> {
  survivorId: SurvivorId;
  outcomeType: SurvivorOutcome;
  cause: string;
  attribution: "killer" | "survivor" | "system" | "unknown";
}

export interface ControllerChangedEvent
  extends BaseMatchEvent<"controller_changed"> {
  survivorId: SurvivorId;
  from: "human";
  to: "bot";
  reason: "disconnect";
}

export interface TrialEndEvent extends BaseMatchEvent<"trial_end"> {
  reason:
    | "all_survivors_resolved"
    | "endgame_collapse"
    | "surrender"
    | "fixture_complete"
    | "abnormal";
  normalEnd: boolean;
}

export type MatchEvent =
  | TrialStartEvent
  | ChaseStartEvent
  | ChaseEndEvent
  | SurvivorInjuredEvent
  | SurvivorDownedEvent
  | SurvivorPickedUpEvent
  | SurvivorReleasedEvent
  | HookCompletedEvent
  | HookStageAdvancedEvent
  | SurvivorUnhookedEvent
  | GeneratorRepairStartedEvent
  | GeneratorRepairStoppedEvent
  | GeneratorProgressDeltaEvent
  | GeneratorRegressionStartedEvent
  | GeneratorRegressionPausedEvent
  | GeneratorRegressionResumedEvent
  | GeneratorRegressionStoppedEvent
  | GeneratorBlockedEvent
  | GeneratorUnblockedEvent
  | GeneratorCompletedEvent
  | SurvivorOutcomeEvent
  | ControllerChangedEvent
  | TrialEndEvent;

export interface MatchLog {
  schemaVersion: SupportedSchemaVersion;
  ruleset: SupportedRuleset;
  patch: SupportedPatch;
  matchId: string;
  durationMs: Milliseconds;
  survivors: SurvivorId[];
  generators: GeneratorId[];
  unsupportedMechanics: string[];
  events: MatchEvent[];
}

export type ValidationSeverity = "error" | "warning";

export interface ValidationIssue {
  severity: ValidationSeverity;
  code: string;
  path: string;
  message: string;
  eventIndex?: number;
}

export interface ValidationResult<T> {
  ok: boolean;
  data: T | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}
