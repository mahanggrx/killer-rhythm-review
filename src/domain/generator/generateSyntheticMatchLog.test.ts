import { describe, expect, it } from "vitest";
import { parseMatchLogJson } from "../log";
import {
  DEFAULT_SYNTHETIC_LOG_INPUT,
  generateSyntheticMatchLog,
  validateSyntheticLogInput,
} from ".";

describe("generateSyntheticMatchLog", () => {
  it("生成可通过现有校验并精确回算四项输入指标的日志", () => {
    const result = generateSyntheticMatchLog({
      averageChaseGapSeconds: 50,
      firstChaseDurationSeconds: 35,
      generatorsRemainingAtFirstElimination: 1,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(parseMatchLogJson(result.source).ok).toBe(true);
    expect(result.verification).toEqual({
      averageChaseGapSeconds: 50,
      firstChaseDurationSeconds: 35,
      generatorsRemainingAtFirstElimination: 1,
    });
    expect(result.log.events.at(0)?.type).toBe("trial_start");
    expect(result.log.events.at(-1)?.type).toBe("trial_end");
    const down = result.log.events.find((event) => event.type === "survivor_downed");
    const bleedOut = result.log.events.find(
      (event) => event.type === "survivor_outcome" && event.outcomeType === "bled_out",
    );
    expect(down).toBeDefined();
    expect(bleedOut).toBeDefined();
    if (!down || !bleedOut) return;
    expect(bleedOut.timestampMs - down.timestampMs).toBeGreaterThanOrEqual(240_000);
  });

  it("相同输入始终生成完全相同的日志", () => {
    const first = generateSyntheticMatchLog(DEFAULT_SYNTHETIC_LOG_INPUT);
    const second = generateSyntheticMatchLog(DEFAULT_SYNTHETIC_LOG_INPUT);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    expect(first.source).toBe(second.source);
  });

  it("支持零平均追逐空窗和剩余发电机边界", () => {
    const allCompleted = generateSyntheticMatchLog({
      averageChaseGapSeconds: 0,
      firstChaseDurationSeconds: 1,
      generatorsRemainingAtFirstElimination: 0,
    });
    const noneCompleted = generateSyntheticMatchLog({
      averageChaseGapSeconds: 0,
      firstChaseDurationSeconds: 1,
      generatorsRemainingAtFirstElimination: 5,
    });

    expect(allCompleted.ok).toBe(true);
    expect(noneCompleted.ok).toBe(true);
    if (!allCompleted.ok || !noneCompleted.ok) return;

    expect(allCompleted.verification.generatorsRemainingAtFirstElimination).toBe(0);
    expect(noneCompleted.verification.generatorsRemainingAtFirstElimination).toBe(5);
  });

  it("拒绝负数、非整数和越界发电机数量", () => {
    const issues = validateSyntheticLogInput({
      averageChaseGapSeconds: -1,
      firstChaseDurationSeconds: 1.5,
      generatorsRemainingAtFirstElimination: 6,
    });

    expect(issues.map((issue) => issue.code)).toEqual([
      "OUT_OF_RANGE",
      "NOT_INTEGER",
      "OUT_OF_RANGE",
    ]);
  });

  it("拒绝非有限数值", () => {
    const issues = validateSyntheticLogInput({
      averageChaseGapSeconds: Number.NaN,
      firstChaseDurationSeconds: 20,
      generatorsRemainingAtFirstElimination: 3,
    });

    expect(issues[0]?.code).toBe("NOT_FINITE");
  });
});
