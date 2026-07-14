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
});
