import {
  SUPPORTED_EVENT_TYPES,
  SUPPORTED_PATCH,
  SUPPORTED_RULESET,
  SUPPORTED_SCHEMA_VERSION,
  type MatchEventType,
  type MatchLog,
  type ValidationIssue,
  type ValidationResult,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const supportedEventTypes = new Set<string>(SUPPORTED_EVENT_TYPES);

const targetEvidenceTypes = [
  "direct_los",
  "aura",
  "scream",
  "killer_instinct",
  "scratch_marks",
  "blood",
  "sound",
  "manual",
] as const;

const evidenceConfidences = ["confirmed", "probable", "uncertain"] as const;
const chaseEndReasons = [
  "lost_los",
  "range_break",
  "locker",
  "target_downed",
  "target_switch",
  "trial_end",
  "unknown",
] as const;
const healthStates = ["healthy", "injured", "dying"] as const;
const attributionTypes = [
  "killer",
  "survivor",
  "system",
  "unknown",
] as const;
const survivorOutcomes = [
  "sacrificed",
  "killed",
  "bled_out",
  "escaped",
] as const;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function error(
  issues: ValidationIssue[],
  code: string,
  path: string,
  message: string,
  eventIndex?: number,
) {
  issues.push({
    severity: "error",
    code,
    path,
    message,
    ...(eventIndex === undefined ? {} : { eventIndex }),
  });
}

function warning(
  issues: ValidationIssue[],
  code: string,
  path: string,
  message: string,
  eventIndex?: number,
) {
  issues.push({
    severity: "warning",
    code,
    path,
    message,
    ...(eventIndex === undefined ? {} : { eventIndex }),
  });
}

function requireString(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  eventIndex?: number,
): string | null {
  const value = record[key];

  if (typeof value !== "string" || value.trim().length === 0) {
    error(
      errors,
      "REQUIRED_STRING",
      `${path}.${key}`,
      `${key} 必须是非空字符串`,
      eventIndex,
    );
    return null;
  }

  return value;
}

function optionalString(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  eventIndex?: number,
): string | null {
  const value = record[key];

  if (value === undefined) {
    return null;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    error(
      errors,
      "OPTIONAL_STRING_INVALID",
      `${path}.${key}`,
      `${key} 如存在，必须是非空字符串`,
      eventIndex,
    );
    return null;
  }

  return value;
}

function requireFiniteNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  eventIndex?: number,
): number | null {
  const value = record[key];

  if (typeof value !== "number" || !Number.isFinite(value)) {
    error(
      errors,
      "FINITE_NUMBER_REQUIRED",
      `${path}.${key}`,
      `${key} 必须是有限数字`,
      eventIndex,
    );
    return null;
  }

  return value;
}

function requireNonNegativeNumber(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  eventIndex?: number,
): number | null {
  const value = requireFiniteNumber(record, key, path, errors, eventIndex);

  if (value !== null && value < 0) {
    error(
      errors,
      key === "timestampMs" ? "TIMESTAMP_NEGATIVE" : "NEGATIVE_NUMBER",
      `${path}.${key}`,
      `${key} 不得为负数`,
      eventIndex,
    );
    return null;
  }

  return value;
}

function requireInteger(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  options: { min?: number; max?: number; code?: string } = {},
  eventIndex?: number,
): number | null {
  const value = requireFiniteNumber(record, key, path, errors, eventIndex);

  if (value === null) {
    return null;
  }

  if (
    !Number.isInteger(value) ||
    (options.min !== undefined && value < options.min) ||
    (options.max !== undefined && value > options.max)
  ) {
    error(
      errors,
      options.code ?? "INTEGER_OUT_OF_RANGE",
      `${path}.${key}`,
      `${key} 必须是${
        options.min === undefined ? "" : `不小于 ${options.min} 的`
      }${options.max === undefined ? "" : `且不大于 ${options.max} 的`}整数`,
      eventIndex,
    );
    return null;
  }

  return value;
}

function requireBoolean(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  eventIndex?: number,
): boolean | null {
  const value = record[key];

  if (typeof value !== "boolean") {
    error(
      errors,
      "BOOLEAN_REQUIRED",
      `${path}.${key}`,
      `${key} 必须是布尔值`,
      eventIndex,
    );
    return null;
  }

  return value;
}

function requireEnum<TValue extends string | number>(
  record: UnknownRecord,
  key: string,
  allowed: readonly TValue[],
  path: string,
  errors: ValidationIssue[],
  eventIndex?: number,
): TValue | null {
  const value = record[key];

  if (!allowed.includes(value as TValue)) {
    error(
      errors,
      "ENUM_VALUE_INVALID",
      `${path}.${key}`,
      `${key} 必须是以下值之一：${allowed.join("、")}`,
      eventIndex,
    );
    return null;
  }

  return value as TValue;
}

function requireRatio(
  record: UnknownRecord,
  key: string,
  path: string,
  errors: ValidationIssue[],
  eventIndex?: number,
): number | null {
  const value = requireFiniteNumber(record, key, path, errors, eventIndex);

  if (value !== null && (value < 0 || value > 1)) {
    error(
      errors,
      "PROGRESS_OUT_OF_RANGE",
      `${path}.${key}`,
      `${key} 必须在 0 到 1 之间`,
      eventIndex,
    );
    return null;
  }

  return value;
}

function validateIdList(
  value: unknown,
  path: string,
  expectedCount: number,
  errors: ValidationIssue[],
): Set<string> {
  if (!Array.isArray(value)) {
    error(errors, "ID_LIST_REQUIRED", path, `${path} 必须是字符串数组`);
    return new Set();
  }

  const ids = new Set<string>();

  value.forEach((item, index) => {
    const itemPath = `${path}[${index}]`;

    if (typeof item !== "string" || item.trim().length === 0) {
      error(errors, "ID_INVALID", itemPath, "ID 必须是非空字符串");
      return;
    }

    if (ids.has(item)) {
      error(errors, "DUPLICATE_ENTITY_ID", itemPath, `实体 ID ${item} 重复`);
      return;
    }

    ids.add(item);
  });

  if (value.length !== expectedCount) {
    error(
      errors,
      "ENTITY_COUNT_INVALID",
      path,
      `${SUPPORTED_RULESET} 要求 ${path} 包含 ${expectedCount} 个 ID`,
    );
  }

  return ids;
}

function validateUnsupportedMechanics(
  value: unknown,
  errors: ValidationIssue[],
  warnings: ValidationIssue[],
) {
  if (!Array.isArray(value)) {
    error(
      errors,
      "UNSUPPORTED_MECHANICS_LIST_REQUIRED",
      "$.unsupportedMechanics",
      "unsupportedMechanics 必须是字符串数组",
    );
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      error(
        errors,
        "UNSUPPORTED_MECHANIC_INVALID",
        `$.unsupportedMechanics[${index}]`,
        "未支持机制名称必须是非空字符串",
      );
    }
  });

  if (value.length > 0) {
    warning(
      warnings,
      "UNSUPPORTED_MECHANICS_DECLARED",
      "$.unsupportedMechanics",
      "日志声明了基础规则集之外的机制，后续分析阶段必须警告或拒绝处理",
    );
  }
}

function requireKnownSurvivor(
  event: UnknownRecord,
  key: string,
  path: string,
  survivors: Set<string>,
  errors: ValidationIssue[],
  eventIndex: number,
): string | null {
  const survivorId = requireString(event, key, path, errors, eventIndex);

  if (survivorId !== null && !survivors.has(survivorId)) {
    error(
      errors,
      "UNKNOWN_SURVIVOR_ID",
      `${path}.${key}`,
      `未找到逃生者 ${survivorId}`,
      eventIndex,
    );
  }

  return survivorId;
}

function requireKnownGenerator(
  event: UnknownRecord,
  path: string,
  generators: Set<string>,
  errors: ValidationIssue[],
  eventIndex: number,
): string | null {
  const generatorId = requireString(
    event,
    "generatorId",
    path,
    errors,
    eventIndex,
  );

  if (generatorId !== null && !generators.has(generatorId)) {
    error(
      errors,
      "UNKNOWN_GENERATOR_ID",
      `${path}.generatorId`,
      `未找到发电机 ${generatorId}`,
      eventIndex,
    );
  }

  return generatorId;
}

function validateContributors(
  value: unknown,
  path: string,
  survivors: Set<string>,
  errors: ValidationIssue[],
  eventIndex: number,
) {
  if (!Array.isArray(value)) {
    error(
      errors,
      "CONTRIBUTORS_REQUIRED",
      path,
      "contributors 必须是逃生者 ID 数组",
      eventIndex,
    );
    return;
  }

  value.forEach((item, index) => {
    if (typeof item !== "string" || !survivors.has(item)) {
      error(
        errors,
        "UNKNOWN_SURVIVOR_ID",
        `${path}[${index}]`,
        `贡献者 ${String(item)} 不是已声明的逃生者`,
        eventIndex,
      );
    }
  });
}

function validateEventFields(
  event: UnknownRecord,
  type: MatchEventType,
  path: string,
  survivors: Set<string>,
  generators: Set<string>,
  errors: ValidationIssue[],
  eventIndex: number,
) {
  const survivor = () =>
    requireKnownSurvivor(
      event,
      "survivorId",
      path,
      survivors,
      errors,
      eventIndex,
    );
  const generator = () =>
    requireKnownGenerator(event, path, generators, errors, eventIndex);
  const progress = () =>
    requireRatio(event, "progress", path, errors, eventIndex);

  switch (type) {
    case "trial_start":
      return;

    case "target_acquired":
      survivor();
      requireEnum(
        event,
        "evidenceType",
        targetEvidenceTypes,
        path,
        errors,
        eventIndex,
      );
      requireEnum(
        event,
        "confidence",
        evidenceConfidences,
        path,
        errors,
        eventIndex,
      );
      requireString(event, "observerNote", path, errors, eventIndex);
      return;

    case "chase_start":
      survivor();
      requireString(event, "chaseId", path, errors, eventIndex);
      requireEnum(
        event,
        "source",
        ["game_state", "manual"],
        path,
        errors,
        eventIndex,
      );
      return;

    case "chase_end":
      survivor();
      requireString(event, "chaseId", path, errors, eventIndex);
      requireEnum(
        event,
        "endReason",
        chaseEndReasons,
        path,
        errors,
        eventIndex,
      );
      requireBoolean(event, "censored", path, errors, eventIndex);
      requireBoolean(event, "policyGenerated", path, errors, eventIndex);
      return;

    case "survivor_injured":
      survivor();
      requireEnum(
        event,
        "fromState",
        ["healthy"],
        path,
        errors,
        eventIndex,
      );
      requireString(event, "cause", path, errors, eventIndex);
      optionalString(event, "sourceId", path, errors, eventIndex);
      return;

    case "survivor_downed":
      survivor();
      requireEnum(
        event,
        "fromState",
        ["healthy", "injured"],
        path,
        errors,
        eventIndex,
      );
      requireString(event, "cause", path, errors, eventIndex);
      requireEnum(
        event,
        "attribution",
        attributionTypes,
        path,
        errors,
        eventIndex,
      );
      optionalString(event, "sourceId", path, errors, eventIndex);
      return;

    case "survivor_picked_up":
      survivor();
      requireEnum(
        event,
        "priorHealthState",
        healthStates,
        path,
        errors,
        eventIndex,
      );
      requireEnum(
        event,
        "pickupMethod",
        ["ground", "interaction_grab"],
        path,
        errors,
        eventIndex,
      );
      return;

    case "survivor_released":
      survivor();
      requireEnum(
        event,
        "reason",
        ["killer_drop", "wiggle", "stun_save", "blind_save", "other"],
        path,
        errors,
        eventIndex,
      );
      return;

    case "hook_completed": {
      survivor();
      requireString(event, "hookId", path, errors, eventIndex);
      const stageBefore = requireInteger(
        event,
        "stageBefore",
        path,
        errors,
        { min: 0, max: 2, code: "HOOK_STAGE_OUT_OF_RANGE" },
        eventIndex,
      );
      const stageAfter = requireInteger(
        event,
        "stageAfter",
        path,
        errors,
        { min: 0, max: 2, code: "HOOK_STAGE_OUT_OF_RANGE" },
        eventIndex,
      );
      requireInteger(
        event,
        "hookNumber",
        path,
        errors,
        { min: 1, max: 3 },
        eventIndex,
      );
      requireBoolean(event, "isDeathHook", path, errors, eventIndex);
      requireBoolean(event, "isStandardHook", path, errors, eventIndex);

      if (
        stageBefore !== null &&
        stageAfter !== null &&
        stageAfter < stageBefore
      ) {
        error(
          errors,
          "HOOK_STAGE_REGRESSION",
          `${path}.stageAfter`,
          "基础规则集中的普通挂钩不能降低挂钩阶段",
          eventIndex,
        );
      }
      return;
    }

    case "hook_stage_advanced":
      survivor();
      requireInteger(
        event,
        "fromStage",
        path,
        errors,
        { min: 1, max: 2, code: "HOOK_STAGE_OUT_OF_RANGE" },
        eventIndex,
      );
      requireEnum(event, "toStage", [2], path, errors, eventIndex);
      requireEnum(
        event,
        "cause",
        ["timer", "other"],
        path,
        errors,
        eventIndex,
      );
      return;

    case "survivor_unhooked": {
      survivor();
      const rescuerId = event.rescuerId;
      if (rescuerId !== null) {
        requireKnownSurvivor(
          event,
          "rescuerId",
          path,
          survivors,
          errors,
          eventIndex,
        );
      }
      requireEnum(
        event,
        "method",
        ["rescued", "self_unhook", "anti_camp", "other"],
        path,
        errors,
        eventIndex,
      );
      requireInteger(
        event,
        "stageAtRelease",
        path,
        errors,
        { min: 1, max: 2, code: "HOOK_STAGE_OUT_OF_RANGE" },
        eventIndex,
      );
      return;
    }

    case "generator_repair_started":
      generator();
      survivor();
      progress();
      return;

    case "generator_repair_stopped":
      generator();
      survivor();
      progress();
      requireEnum(
        event,
        "reason",
        ["voluntary", "forced_off", "injured", "downed", "other"],
        path,
        errors,
        eventIndex,
      );
      return;

    case "generator_progress_delta": {
      generator();
      const delta = requireFiniteNumber(
        event,
        "delta",
        path,
        errors,
        eventIndex,
      );
      const before = requireRatio(
        event,
        "progressBefore",
        path,
        errors,
        eventIndex,
      );
      const after = requireRatio(
        event,
        "progressAfter",
        path,
        errors,
        eventIndex,
      );
      requireString(event, "cause", path, errors, eventIndex);
      optionalString(event, "sourceId", path, errors, eventIndex);
      const applied = requireBoolean(
        event,
        "applied",
        path,
        errors,
        eventIndex,
      );
      const killerCaused = requireBoolean(
        event,
        "killerCaused",
        path,
        errors,
        eventIndex,
      );
      const interferenceId = optionalString(
        event,
        "interferenceId",
        path,
        errors,
        eventIndex,
      );

      if (
        applied === true &&
        before !== null &&
        after !== null &&
        delta !== null &&
        Math.abs(before + delta - after) > 0.000_001
      ) {
        error(
          errors,
          "PROGRESS_DELTA_MISMATCH",
          `${path}.progressAfter`,
          "progressBefore + delta 必须等于 progressAfter",
          eventIndex,
        );
      }

      if (applied === false && before !== null && after !== null && before !== after) {
        error(
          errors,
          "UNAPPLIED_PROGRESS_CHANGED",
          `${path}.progressAfter`,
          "applied 为 false 时进度不得变化",
          eventIndex,
        );
      }

      if (killerCaused === true && applied === true && interferenceId === null) {
        error(
          errors,
          "INTERFERENCE_ID_REQUIRED",
          `${path}.interferenceId`,
          "实际生效的杀手控机事件必须提供 interferenceId",
          eventIndex,
        );
      }
      return;
    }

    case "generator_regression_started":
      generator();
      progress();
      requireString(event, "regressionId", path, errors, eventIndex);
      requireString(event, "interferenceId", path, errors, eventIndex);
      requireString(event, "source", path, errors, eventIndex);
      requireInteger(
        event,
        "regressionEventIndex",
        path,
        errors,
        { min: 1, max: 8 },
        eventIndex,
      );
      return;

    case "generator_regression_paused":
      generator();
      progress();
      requireString(event, "regressionId", path, errors, eventIndex);
      requireEnum(
        event,
        "reason",
        ["repairing", "blocked"],
        path,
        errors,
        eventIndex,
      );
      return;

    case "generator_regression_resumed":
      generator();
      progress();
      requireString(event, "regressionId", path, errors, eventIndex);
      requireEnum(
        event,
        "reason",
        ["repair_ended", "unblocked"],
        path,
        errors,
        eventIndex,
      );
      return;

    case "generator_regression_stopped":
      generator();
      progress();
      requireString(event, "regressionId", path, errors, eventIndex);
      requireEnum(
        event,
        "reason",
        ["repaired_5_percent", "zero", "completed", "trial_end"],
        path,
        errors,
        eventIndex,
      );
      requireBoolean(event, "censored", path, errors, eventIndex);
      return;

    case "generator_blocked": {
      generator();
      progress();
      requireString(event, "interferenceId", path, errors, eventIndex);
      requireString(event, "source", path, errors, eventIndex);
      if (event.durationExpectedMs !== undefined) {
        requireNonNegativeNumber(
          event,
          "durationExpectedMs",
          path,
          errors,
          eventIndex,
        );
      }
      return;
    }

    case "generator_unblocked":
      generator();
      progress();
      requireString(event, "source", path, errors, eventIndex);
      return;

    case "generator_completed":
      generator();
      requireEnum(event, "progress", [1], path, errors, eventIndex);
      requireInteger(
        event,
        "completionIndex",
        path,
        errors,
        { min: 1, max: 5 },
        eventIndex,
      );
      validateContributors(
        event.contributors,
        `${path}.contributors`,
        survivors,
        errors,
        eventIndex,
      );
      return;

    case "survivor_outcome":
      survivor();
      requireEnum(
        event,
        "outcomeType",
        survivorOutcomes,
        path,
        errors,
        eventIndex,
      );
      requireString(event, "cause", path, errors, eventIndex);
      requireEnum(
        event,
        "attribution",
        attributionTypes,
        path,
        errors,
        eventIndex,
      );
      return;

    case "controller_changed":
      survivor();
      requireEnum(event, "from", ["human"], path, errors, eventIndex);
      requireEnum(event, "to", ["bot"], path, errors, eventIndex);
      requireEnum(event, "reason", ["disconnect"], path, errors, eventIndex);
      return;

    case "trial_end":
      requireEnum(
        event,
        "reason",
        [
          "all_survivors_resolved",
          "endgame_collapse",
          "surrender",
          "fixture_complete",
          "abnormal",
        ],
        path,
        errors,
        eventIndex,
      );
      requireBoolean(event, "normalEnd", path, errors, eventIndex);
      return;
  }
}

export function validateMatchLog(input: unknown): ValidationResult<MatchLog> {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  if (!isRecord(input)) {
    error(errors, "ROOT_OBJECT_REQUIRED", "$", "日志根节点必须是对象");
    return { ok: false, data: null, errors, warnings };
  }

  const schemaVersion = requireString(
    input,
    "schemaVersion",
    "$",
    errors,
  );
  const ruleset = requireString(input, "ruleset", "$", errors);
  const patch = requireString(input, "patch", "$", errors);
  requireString(input, "matchId", "$", errors);
  const durationMs = requireNonNegativeNumber(
    input,
    "durationMs",
    "$",
    errors,
  );

  if (
    schemaVersion !== null &&
    schemaVersion !== SUPPORTED_SCHEMA_VERSION
  ) {
    error(
      errors,
      "UNSUPPORTED_SCHEMA_VERSION",
      "$.schemaVersion",
      `仅支持日志版本 ${SUPPORTED_SCHEMA_VERSION}`,
    );
  }

  if (ruleset !== null && ruleset !== SUPPORTED_RULESET) {
    error(
      errors,
      "UNSUPPORTED_RULESET",
      "$.ruleset",
      `仅支持规则集 ${SUPPORTED_RULESET}`,
    );
  }

  if (patch !== null && patch !== SUPPORTED_PATCH) {
    error(
      errors,
      "UNSUPPORTED_PATCH",
      "$.patch",
      `当前原型只验证 ${SUPPORTED_PATCH} 机制基线`,
    );
  }

  const survivors = validateIdList(
    input.survivors,
    "$.survivors",
    4,
    errors,
  );
  const generators = validateIdList(
    input.generators,
    "$.generators",
    7,
    errors,
  );
  validateUnsupportedMechanics(
    input.unsupportedMechanics,
    errors,
    warnings,
  );

  if (!Array.isArray(input.events)) {
    error(errors, "EVENTS_ARRAY_REQUIRED", "$.events", "events 必须是数组");
    return { ok: false, data: null, errors, warnings };
  }

  const eventIds = new Set<string>();
  const eventOrders = new Set<number>();
  const sortableEvents: Array<{
    timestampMs: number;
    eventOrder: number;
    eventIndex: number;
  }> = [];
  let trialStartCount = 0;
  let trialEndCount = 0;

  input.events.forEach((rawEvent, eventIndex) => {
    const path = `$.events[${eventIndex}]`;

    if (!isRecord(rawEvent)) {
      error(
        errors,
        "EVENT_OBJECT_REQUIRED",
        path,
        "每个事件必须是对象",
        eventIndex,
      );
      return;
    }

    const eventId = requireString(
      rawEvent,
      "eventId",
      path,
      errors,
      eventIndex,
    );
    const timestampMs = requireNonNegativeNumber(
      rawEvent,
      "timestampMs",
      path,
      errors,
      eventIndex,
    );
    const eventOrder = requireInteger(
      rawEvent,
      "eventOrder",
      path,
      errors,
      { min: 0 },
      eventIndex,
    );
    const type = requireString(rawEvent, "type", path, errors, eventIndex);

    if (eventId !== null) {
      if (eventIds.has(eventId)) {
        error(
          errors,
          "DUPLICATE_EVENT_ID",
          `${path}.eventId`,
          `事件 ID ${eventId} 重复`,
          eventIndex,
        );
      }
      eventIds.add(eventId);
    }

    if (eventOrder !== null) {
      if (eventOrders.has(eventOrder)) {
        error(
          errors,
          "DUPLICATE_EVENT_ORDER",
          `${path}.eventOrder`,
          `eventOrder ${eventOrder} 重复`,
          eventIndex,
        );
      }
      eventOrders.add(eventOrder);
    }

    if (
      timestampMs !== null &&
      durationMs !== null &&
      timestampMs > durationMs
    ) {
      error(
        errors,
        "TIMESTAMP_AFTER_MATCH",
        `${path}.timestampMs`,
        "事件时间不得超过对局总时长",
        eventIndex,
      );
    }

    if (timestampMs !== null && eventOrder !== null) {
      sortableEvents.push({ timestampMs, eventOrder, eventIndex });
    }

    if (type === "trial_start") {
      trialStartCount += 1;
      if (timestampMs !== null && timestampMs !== 0) {
        error(
          errors,
          "TRIAL_START_NOT_ZERO",
          `${path}.timestampMs`,
          "trial_start 的 timestampMs 必须为 0",
          eventIndex,
        );
      }
    }
    if (type === "trial_end") {
      trialEndCount += 1;
    }

    if (type === null) {
      return;
    }

    if (!supportedEventTypes.has(type)) {
      error(
        errors,
        "UNKNOWN_EVENT_TYPE",
        `${path}.type`,
        `未知事件类型：${type}`,
        eventIndex,
      );
      return;
    }

    validateEventFields(
      rawEvent,
      type as MatchEventType,
      path,
      survivors,
      generators,
      errors,
      eventIndex,
    );
  });

  if (trialStartCount !== 1) {
    error(
      errors,
      "TRIAL_START_COUNT_INVALID",
      "$.events",
      "日志必须且只能包含一个 trial_start",
    );
  }

  if (trialEndCount !== 1) {
    error(
      errors,
      "TRIAL_END_COUNT_INVALID",
      "$.events",
      "日志必须且只能包含一个 trial_end",
    );
  }

  for (let index = 1; index < sortableEvents.length; index += 1) {
    const previous = sortableEvents[index - 1];
    const current = sortableEvents[index];

    if (
      previous.timestampMs > current.timestampMs ||
      (previous.timestampMs === current.timestampMs &&
        previous.eventOrder > current.eventOrder)
    ) {
      warning(
        warnings,
        "EVENTS_OUT_OF_ORDER",
        "$.events",
        "事件未按 timestampMs 与 eventOrder 排序，解析成功后将稳定排序",
        current.eventIndex,
      );
      break;
    }
  }

  if (errors.length > 0) {
    return { ok: false, data: null, errors, warnings };
  }

  return {
    ok: true,
    data: input as unknown as MatchLog,
    errors,
    warnings,
  };
}
