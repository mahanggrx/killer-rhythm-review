import { describe, expect, it } from "vitest";
import invalidSample from "../../data/samples/invalid-match.json";
import validSample from "../../data/samples/valid-base-match.json";
import { parseMatchLogJson } from "./parseMatchLog";
import { validateMatchLog } from "./validateMatchLog";

function errorCodes(result: ReturnType<typeof validateMatchLog>) {
  return result.errors.map((issue) => issue.code);
}

describe("validateMatchLog", () => {
  it("接受符合 base_only_1v4_10.0.2 的合法日志", () => {
    const result = validateMatchLog(validSample);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.data?.events).toHaveLength(23);
  });

  it("为重复 ID、未知事件、非法进度和缺少结束事件返回明确错误", () => {
    const result = validateMatchLog(invalidSample);
    const codes = errorCodes(result);

    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(codes).toContain("DUPLICATE_EVENT_ID");
    expect(codes).toContain("DUPLICATE_EVENT_ORDER");
    expect(codes).toContain("UNKNOWN_EVENT_TYPE");
    expect(codes).toContain("PROGRESS_OUT_OF_RANGE");
    expect(codes).toContain("TIMESTAMP_NEGATIVE");
    expect(codes).toContain("TRIAL_END_COUNT_INVALID");
  });

  it("拒绝引用未声明逃生者的事件", () => {
    const input = structuredClone(validSample);
    const targetEvent = input.events.find(
      (event) => event.type === "target_acquired",
    );

    if (!targetEvent || !("survivorId" in targetEvent)) {
      throw new Error("测试样例缺少 target_acquired");
    }

    targetEvent.survivorId = "survivor-not-declared";
    const result = validateMatchLog(input);

    expect(errorCodes(result)).toContain("UNKNOWN_SURVIVOR_ID");
  });

  it("拒绝越界的挂钩阶段", () => {
    const input = structuredClone(validSample) as unknown as {
      events: Array<Record<string, unknown>>;
    };
    const hookEvent = input.events.find(
      (event) => event.type === "hook_completed",
    );

    if (!hookEvent) {
      throw new Error("测试样例缺少 hook_completed");
    }

    hookEvent.stageAfter = 3;
    const result = validateMatchLog(input);

    expect(errorCodes(result)).toContain("HOOK_STAGE_OUT_OF_RANGE");
  });

  it("允许声明未支持机制，但返回可见警告", () => {
    const input = {
      ...structuredClone(validSample),
      unsupportedMechanics: ["hook_stage_transfer"],
    };

    const result = validateMatchLog(input);

    expect(result.ok).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toContain(
      "UNSUPPORTED_MECHANICS_DECLARED",
    );
  });

  it("拒绝追逐起止目标不一致和完成后的发电机事件", () => {
    const input = structuredClone(validSample) as unknown as {
      events: Array<Record<string, unknown>>;
    };
    const chaseEnd = input.events.find(
      (event) => event.type === "chase_end" && event.chaseId === "chase-1",
    );
    if (!chaseEnd) throw new Error("测试样例缺少 chase_end");
    chaseEnd.survivorId = "survivor-2";
    input.events.push({
      eventId: "event-after-completion",
      timestampMs: 140_000,
      eventOrder: 99,
      type: "generator_repair_started",
      generatorId: "generator-1",
      survivorId: "survivor-2",
      progress: 1,
    });

    const result = validateMatchLog(input);

    expect(errorCodes(result)).toEqual(
      expect.arrayContaining([
        "CHASE_SURVIVOR_MISMATCH",
        "GENERATOR_EVENT_AFTER_COMPLETION",
      ]),
    );
  });

  it("拒绝无效离钩顺序、离场后事件和异常结束对局", () => {
    const input = structuredClone(validSample);
    const unhook = input.events.find((event) => event.type === "survivor_unhooked");
    const controllerChange = input.events.find((event) => event.type === "controller_changed");
    const trialEnd = input.events.find((event) => event.type === "trial_end");
    if (!unhook || !controllerChange || !trialEnd) throw new Error("测试样例缺少语义事件");
    unhook.stageAtRelease = 2;
    controllerChange.survivorId = "survivor-1";
    controllerChange.timestampMs = 230_000;
    trialEnd.reason = "abnormal";
    trialEnd.normalEnd = false;

    const result = validateMatchLog(input);

    expect(errorCodes(result)).toEqual(
      expect.arrayContaining([
        "UNHOOK_STATE_INVALID",
        "EVENT_AFTER_SURVIVOR_OUTCOME",
        "ABNORMAL_TRIAL_END_UNSUPPORTED",
      ]),
    );
  });

  it("拒绝缺少抱起事件的普通挂钩", () => {
    const input = structuredClone(validSample);
    input.events = input.events.filter(
      (event) => !(event.type === "survivor_picked_up" && event.survivorId === "survivor-1"),
    );

    const result = validateMatchLog(input);

    expect(errorCodes(result)).toContain("HOOK_WITHOUT_PICKUP");
  });

  it("拒绝无起点的回退转换和无封锁状态的解除事件", () => {
    const input = structuredClone(validSample) as unknown as {
      events: Array<Record<string, unknown>>;
    };
    input.events.push(
      {
        eventId: "invalid-regression-resume",
        timestampMs: 150_000,
        eventOrder: 98,
        type: "generator_regression_resumed",
        regressionId: "missing-regression",
        generatorId: "generator-2",
        progress: 0.5,
        reason: "repair_ended",
      },
      {
        eventId: "invalid-unblock",
        timestampMs: 160_000,
        eventOrder: 99,
        type: "generator_unblocked",
        generatorId: "generator-2",
        progress: 0.5,
        source: "test",
      },
    );

    const result = validateMatchLog(input);

    expect(errorCodes(result)).toEqual(
      expect.arrayContaining([
        "REGRESSION_EVENT_WITHOUT_START",
        "GENERATOR_UNBLOCKED_WITHOUT_BLOCK",
      ]),
    );
  });
});

describe("parseMatchLogJson", () => {
  it("稳定排序乱序事件，并保留同时间戳下的 eventOrder", () => {
    const input = structuredClone(validSample);
    input.events.reverse();

    const result = parseMatchLogJson(JSON.stringify(input));

    expect(result.ok).toBe(true);
    expect(result.warnings.map((issue) => issue.code)).toContain(
      "EVENTS_OUT_OF_ORDER",
    );
    expect(result.data?.events[0].type).toBe("trial_start");
    expect(result.data?.events.at(-1)?.type).toBe("trial_end");

    const eventsAtSixtySeconds = result.data?.events.filter(
      (event) => event.timestampMs === 60000,
    );
    expect(eventsAtSixtySeconds?.map((event) => event.type)).toEqual([
      "survivor_downed",
      "chase_end",
    ]);
  });

  it("面对损坏的 JSON 返回错误而不是抛出异常", () => {
    expect(() => parseMatchLogJson('{"events":')).not.toThrow();

    const result = parseMatchLogJson('{"events":');

    expect(result.ok).toBe(false);
    expect(result.data).toBeNull();
    expect(result.errors[0].code).toBe("JSON_PARSE_ERROR");
  });

  it("为倒地缺失结束事件生成可追溯追逐结束", () => {
    const input = structuredClone(validSample);
    input.events = input.events.filter(
      (event) => !(event.type === "chase_end" && event.chaseId === "chase-1"),
    );

    const result = parseMatchLogJson(JSON.stringify(input));

    expect(result.ok).toBe(true);
    expect(result.warnings.map((item) => item.code)).toContain("CHASE_END_GENERATED_AT_DOWN");
    const generated = result.data?.events.find(
      (event) => event.type === "chase_end" && event.chaseId === "chase-1",
    );
    expect(generated).toEqual(
      expect.objectContaining({
        timestampMs: 60_000,
        endReason: "target_downed",
        censored: false,
        policyGenerated: true,
      }),
    );
  });

  it("在对局结束时以 censored 事件关闭追逐和回退区间", () => {
    const input = structuredClone(validSample);
    input.events = input.events.filter(
      (event) =>
        !(event.type === "chase_end" && event.chaseId === "chase-2") &&
        event.type !== "generator_regression_stopped" &&
        event.type !== "generator_completed",
    );

    const result = parseMatchLogJson(JSON.stringify(input));

    expect(result.ok).toBe(true);
    expect(result.warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "OPEN_CHASE_CENSORED_AT_TRIAL_END",
        "OPEN_REGRESSION_CENSORED_AT_TRIAL_END",
      ]),
    );
    expect(result.data?.events.at(-1)?.type).toBe("trial_end");
    expect(result.data?.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "chase_end",
          chaseId: "chase-2",
          censored: true,
          policyGenerated: true,
        }),
        expect.objectContaining({
          type: "generator_regression_stopped",
          regressionId: "regression-1",
          censored: true,
          policyGenerated: true,
        }),
      ]),
    );
  });
});
