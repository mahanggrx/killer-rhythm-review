import { describe, expect, it } from "vitest";
import { parseMatchLogJson } from "../log";
import {
  DEFAULT_SYNTHETIC_LOG_INPUT,
  generateSyntheticMatchLog,
  validateSyntheticLogInput,
} from ".";

describe("generateSyntheticMatchLog", () => {
  it("生成可通过现有校验并精确回算核心与高级指标的日志", () => {
    const result = generateSyntheticMatchLog({
      firstChaseStartSeconds: 50,
      averageChaseDurationSeconds: 30,
      firstChaseDurationSeconds: 35,
      generatorsRemainingAtFirstElimination: 1,
      completeChaseCount: 4,
      abandonedChaseCount: 2,
      highProgressGeneratorLosses: 3,
      keyGeneratorInterruptions: 2,
      totalEliminations: 3,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(parseMatchLogJson(result.source).ok).toBe(true);
    expect(result.verification).toEqual({
      firstChaseStartSeconds: 50,
      averageChaseDurationSeconds: 30,
      generatorsRemainingAtFirstElimination: 1,
      completeChaseCount: 4,
      firstChaseDurationSeconds: 35,
      averageChaseGapSeconds: 27.5,
      abandonedChaseCount: 2,
      highProgressGeneratorLosses: 3,
      keyGeneratorInterruptions: 2,
      totalEliminations: 3,
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
    expect(first.verification).toEqual({
      firstChaseStartSeconds: 50,
      averageChaseDurationSeconds: 30,
      generatorsRemainingAtFirstElimination: 2,
      completeChaseCount: 2,
      firstChaseDurationSeconds: 30,
      averageChaseGapSeconds: 35,
      abandonedChaseCount: 1,
      highProgressGeneratorLosses: 3,
      keyGeneratorInterruptions: 0,
      totalEliminations: 1,
    });
  });

  it("支持首次立即进入追逐和剩余发电机边界", () => {
    const allCompleted = generateSyntheticMatchLog({
      firstChaseStartSeconds: 0,
      averageChaseDurationSeconds: 1,
      generatorsRemainingAtFirstElimination: 0,
    });
    const noneCompleted = generateSyntheticMatchLog({
      firstChaseStartSeconds: 0,
      averageChaseDurationSeconds: 1,
      generatorsRemainingAtFirstElimination: 5,
    });

    expect(allCompleted.ok).toBe(true);
    expect(noneCompleted.ok).toBe(true);
    if (!allCompleted.ok || !noneCompleted.ok) return;

    expect(allCompleted.verification.generatorsRemainingAtFirstElimination).toBe(0);
    expect(noneCompleted.verification.generatorsRemainingAtFirstElimination).toBe(5);
    expect(noneCompleted.verification.highProgressGeneratorLosses).toBe(0);
    expect(noneCompleted.verification.keyGeneratorInterruptions).toBe(0);
    expect(Object.values(noneCompleted.verification).every(Number.isFinite)).toBe(true);
  });

  it("拒绝负数、非整数和越界发电机数量", () => {
    const issues = validateSyntheticLogInput({
      firstChaseStartSeconds: -1,
      averageChaseDurationSeconds: 1.5,
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
      firstChaseStartSeconds: Number.NaN,
      averageChaseDurationSeconds: 20,
      generatorsRemainingAtFirstElimination: 3,
    });

    expect(issues[0]?.code).toBe("NOT_FINITE");
  });

  it("允许在首次减员后补足高进度丢机，并保持首次减员口径不变", () => {
    const result = generateSyntheticMatchLog({
      firstChaseStartSeconds: 10,
      averageChaseDurationSeconds: 30,
      generatorsRemainingAtFirstElimination: 5,
      highProgressGeneratorLosses: 5,
      totalEliminations: 4,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.verification.generatorsRemainingAtFirstElimination).toBe(5);
    expect(result.verification.highProgressGeneratorLosses).toBe(5);
    expect(result.verification.totalEliminations).toBe(4);
  });

  it("拒绝互相冲突的追逐次数、平均时长和中断次数", () => {
    const tooManyAbandoned = validateSyntheticLogInput({
      firstChaseStartSeconds: 10,
      averageChaseDurationSeconds: 30,
      generatorsRemainingAtFirstElimination: 3,
      completeChaseCount: 2,
      abandonedChaseCount: 3,
    });
    const impossibleAverage = validateSyntheticLogInput({
      firstChaseStartSeconds: 10,
      averageChaseDurationSeconds: 10,
      firstChaseDurationSeconds: 100,
      generatorsRemainingAtFirstElimination: 3,
      completeChaseCount: 2,
    });
    const singleChaseMismatch = validateSyntheticLogInput({
      firstChaseStartSeconds: 10,
      averageChaseDurationSeconds: 20,
      firstChaseDurationSeconds: 30,
      generatorsRemainingAtFirstElimination: 3,
      completeChaseCount: 1,
    });

    expect(tooManyAbandoned).toContainEqual(expect.objectContaining({
      field: "abandonedChaseCount",
      code: "INCONSISTENT_INPUT",
    }));
    expect(impossibleAverage).toContainEqual(expect.objectContaining({
      field: "firstChaseDurationSeconds",
      code: "INCONSISTENT_INPUT",
    }));
    expect(singleChaseMismatch).toContainEqual(expect.objectContaining({
      field: "firstChaseDurationSeconds",
      code: "INCONSISTENT_INPUT",
    }));
  });
});
