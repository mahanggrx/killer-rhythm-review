import { useState, type FormEvent } from "react";
import { DEFAULT_METRIC_CONFIG } from "../config/metricThresholds";
import {
  DEFAULT_SYNTHETIC_LOG_INPUT,
  generateSyntheticMatchLog,
  SYNTHETIC_LOG_LIMITS,
  type SyntheticLogInput,
  type SyntheticLogInputField,
  type SyntheticLogSuccess,
} from "../domain/generator";
import { Icon } from "./Icon";

interface SyntheticLogGeneratorProps {
  onGenerate: (source: string) => void;
  onClose: () => void;
}

type GeneratorFormValues = Record<SyntheticLogInputField, string>;

const DEFAULT_HIGH_PROGRESS_PERCENT = Math.round(
  DEFAULT_METRIC_CONFIG.highProgressThreshold * 100,
);

function toFormValues(
  input: Readonly<SyntheticLogInput>,
): GeneratorFormValues {
  return {
    averageChaseGapSeconds: String(input.averageChaseGapSeconds),
    firstChaseDurationSeconds: String(input.firstChaseDurationSeconds),
    generatorsRemainingAtFirstElimination: String(
      input.generatorsRemainingAtFirstElimination,
    ),
    completeChaseCount: input.completeChaseCount === undefined
      ? ""
      : String(input.completeChaseCount),
    averageChaseDurationSeconds:
      input.averageChaseDurationSeconds === undefined
        ? ""
        : String(input.averageChaseDurationSeconds),
    abandonedChaseCount: input.abandonedChaseCount === undefined
      ? ""
      : String(input.abandonedChaseCount),
    highProgressGeneratorLosses:
      input.highProgressGeneratorLosses === undefined
        ? ""
        : String(input.highProgressGeneratorLosses),
    keyGeneratorInterruptions: input.keyGeneratorInterruptions === undefined
      ? ""
      : String(input.keyGeneratorInterruptions),
    totalEliminations: input.totalEliminations === undefined
      ? ""
      : String(input.totalEliminations),
  };
}

function parseFormNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function parseOptionalFormNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

function formatVerificationValue(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

export function SyntheticLogGenerator({
  onGenerate,
  onClose,
}: SyntheticLogGeneratorProps) {
  const [values, setValues] = useState<GeneratorFormValues>(() =>
    toFormValues(DEFAULT_SYNTHETIC_LOG_INPUT),
  );
  const [generated, setGenerated] = useState<SyntheticLogSuccess | null>(null);
  const [errors, setErrors] = useState<string[]>([]);

  const updateValue = (field: SyntheticLogInputField, value: string) => {
    setValues((current) => ({ ...current, [field]: value }));
    setGenerated(null);
    setErrors([]);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const result = generateSyntheticMatchLog({
      averageChaseGapSeconds: parseFormNumber(values.averageChaseGapSeconds),
      firstChaseDurationSeconds: parseFormNumber(values.firstChaseDurationSeconds),
      generatorsRemainingAtFirstElimination: parseFormNumber(
        values.generatorsRemainingAtFirstElimination,
      ),
      completeChaseCount: parseOptionalFormNumber(values.completeChaseCount),
      averageChaseDurationSeconds: parseOptionalFormNumber(
        values.averageChaseDurationSeconds,
      ),
      abandonedChaseCount: parseOptionalFormNumber(values.abandonedChaseCount),
      highProgressGeneratorLosses: parseOptionalFormNumber(
        values.highProgressGeneratorLosses,
      ),
      keyGeneratorInterruptions: parseOptionalFormNumber(
        values.keyGeneratorInterruptions,
      ),
      totalEliminations: parseOptionalFormNumber(values.totalEliminations),
    });

    if (!result.ok) {
      setGenerated(null);
      setErrors(result.errors.map((issue) => issue.message));
      return;
    }

    setErrors([]);
    setGenerated(result);
    onGenerate(result.source);
  };

  return (
    <section className="generator-panel" aria-labelledby="generator-title">
      <div className="generator-panel__heading">
        <div>
          <p className="section-kicker">合成日志生成器</p>
          <h2 id="generator-title">按指标生成一份可分析的 JSON</h2>
          <p>
            填写三个核心结果，需要时可展开高级设置；生成日志会通过现有校验并回算确认指标一致。
          </p>
        </div>
        <button className="button button--secondary" type="button" onClick={onClose}>
          关闭
        </button>
      </div>

      <form className="generator-form" onSubmit={handleSubmit}>
        <label className="field-control">
          <span>平均追逐空窗（秒）</span>
          <input
            aria-label="平均追逐空窗（秒）"
            type="number"
            min={SYNTHETIC_LOG_LIMITS.minimumSeconds}
            max={SYNTHETIC_LOG_LIMITS.maximumSeconds}
            step="1"
            value={values.averageChaseGapSeconds}
            onChange={(event) => updateValue("averageChaseGapSeconds", event.target.value)}
          />
        </label>
        <label className="field-control">
          <span>首次追逐持续时间（秒）</span>
          <input
            type="number"
            min={SYNTHETIC_LOG_LIMITS.minimumFirstChaseSeconds}
            max={SYNTHETIC_LOG_LIMITS.maximumSeconds}
            step="1"
            value={values.firstChaseDurationSeconds}
            onChange={(event) => updateValue("firstChaseDurationSeconds", event.target.value)}
          />
        </label>
        <label className="field-control">
          <span>首次减员时剩余发电机</span>
          <input
            type="number"
            min={SYNTHETIC_LOG_LIMITS.minimumGeneratorsRemaining}
            max={SYNTHETIC_LOG_LIMITS.maximumGeneratorsRemaining}
            step="1"
            value={values.generatorsRemainingAtFirstElimination}
            onChange={(event) => updateValue(
              "generatorsRemainingAtFirstElimination",
              event.target.value,
            )}
          />
        </label>

        <details className="generator-advanced">
          <summary>
            <span>高级设置</span>
            <small>留空时自动生成确定性默认场景</small>
          </summary>
          <div className="generator-advanced__grid">
            <label className="field-control">
              <span>完整追逐区间数</span>
              <input
                aria-label="完整追逐次数"
                type="number"
                min={SYNTHETIC_LOG_LIMITS.minimumCompleteChases}
                max={SYNTHETIC_LOG_LIMITS.maximumCompleteChases}
                step="1"
                placeholder="自动"
                value={values.completeChaseCount}
                onChange={(event) => updateValue("completeChaseCount", event.target.value)}
              />
              <small className="field-control__help">
                具有明确追逐开始与追逐结束的区间数量；未结束追逐不计。
              </small>
            </label>
            <label className="field-control">
              <span>完整追逐平均时长（秒）</span>
              <input
                aria-label="平均追逐持续时间（秒）"
                type="number"
                min={SYNTHETIC_LOG_LIMITS.minimumAverageChaseSeconds}
                max={SYNTHETIC_LOG_LIMITS.maximumSeconds}
                step="1"
                placeholder="自动"
                value={values.averageChaseDurationSeconds}
                onChange={(event) => updateValue(
                  "averageChaseDurationSeconds",
                  event.target.value,
                )}
              />
              <small className="field-control__help">
                从追逐生效到同一次追逐结束，不包含之后的搬运或挂钩。
              </small>
            </label>
            <label className="field-control">
              <span>以目标丢失或转火结束的追逐数</span>
              <input
                aria-label="目标丢失或转火次数"
                type="number"
                min={SYNTHETIC_LOG_LIMITS.minimumAbandonedChases}
                max={SYNTHETIC_LOG_LIMITS.maximumCompleteChases}
                step="1"
                placeholder="自动"
                value={values.abandonedChaseCount}
                onChange={(event) => updateValue("abandonedChaseCount", event.target.value)}
              />
              <small className="field-control__help">
                目标丢失、距离中断、逃生者进柜或转火，均记 1 次。
              </small>
            </label>
            <label className="field-control">
              <span>高进度电机达到 {DEFAULT_HIGH_PROGRESS_PERCENT}% 后，未被控机即被修开的数量（台）</span>
              <input
                aria-label={`高进度电机达到 ${DEFAULT_HIGH_PROGRESS_PERCENT}% 后未被控机即被修开的数量`}
                type="number"
                min="0"
                max={SYNTHETIC_LOG_LIMITS.maximumHighProgressGeneratorLosses}
                step="1"
                placeholder="自动"
                value={values.highProgressGeneratorLosses}
                onChange={(event) => updateValue(
                  "highProgressGeneratorLosses",
                  event.target.value,
                )}
              />
              <small className="field-control__help">
                “控机”指杀手行为实际造成发电机即时掉进度、开始回退或封锁。高进度电机达到 {DEFAULT_HIGH_PROGRESS_PERCENT}% 后，在下一次控机前完成，记 1 台；同一台最多记 1 台。
              </small>
            </label>
            <label className="field-control">
              <span>对进度 ≥ {DEFAULT_HIGH_PROGRESS_PERCENT}% 的高进度电机的控机次数</span>
              <input
                aria-label={`对进度达到 ${DEFAULT_HIGH_PROGRESS_PERCENT}% 的高进度电机的控机次数`}
                type="number"
                min="0"
                max={SYNTHETIC_LOG_LIMITS.maximumKeyGeneratorInterruptions}
                step="1"
                placeholder="自动"
                value={values.keyGeneratorInterruptions}
                onChange={(event) => updateValue(
                  "keyGeneratorInterruptions",
                  event.target.value,
                )}
              />
              <small className="field-control__help">
                “控机”采用相同定义；同一次杀手行为即使同时造成掉进度和回退，也只记 1 次。逃生者自行停修不计。
              </small>
            </label>
            <label className="field-control">
              <span>最终永久减员数（人）</span>
              <input
                aria-label="最终永久减员数"
                type="number"
                min={SYNTHETIC_LOG_LIMITS.minimumEliminations}
                max={SYNTHETIC_LOG_LIMITS.maximumEliminations}
                step="1"
                placeholder="自动"
                value={values.totalEliminations}
                onChange={(event) => updateValue("totalEliminations", event.target.value)}
              />
              <small className="field-control__help">
                献祭、处决或流血死亡算永久减员；逃脱和 BOT 接管不算。
              </small>
            </label>
          </div>
        </details>

        <div className="generator-form__action">
          <button className="button button--primary" type="submit">
            <Icon name="pulse" />生成并分析
          </button>
          <p>高级参数可以留空；生成结果仅用于构造可验证的规则测试日志。</p>
        </div>
      </form>

      {errors.length > 0 && (
        <div className="generator-errors" role="alert">
          <Icon name="warning" />
          <ul>{errors.map((error) => <li key={error}>{error}</li>)}</ul>
        </div>
      )}

      {generated && (
        <div className="generator-output">
          <div className="generator-verification">
            <p><Icon name="check" />已通过日志校验与指标回算</p>
            <dl>
              <div><dt>平均追逐空窗</dt><dd>{generated.verification.averageChaseGapSeconds} 秒</dd></div>
              <div><dt>首次追逐</dt><dd>{generated.verification.firstChaseDurationSeconds} 秒</dd></div>
              <div><dt>首次减员剩余电机</dt><dd>{generated.verification.generatorsRemainingAtFirstElimination}</dd></div>
              <div><dt>完整追逐</dt><dd>{generated.verification.completeChaseCount} 次</dd></div>
              <div><dt>平均追逐时长</dt><dd>{formatVerificationValue(generated.verification.averageChaseDurationSeconds)} 秒</dd></div>
              <div><dt>目标丢失或转火</dt><dd>{generated.verification.abandonedChaseCount} 次</dd></div>
              <div><dt>高进度电机 ≥ {DEFAULT_HIGH_PROGRESS_PERCENT}% 后未被控机即修开</dt><dd>{generated.verification.highProgressGeneratorLosses} 台</dd></div>
              <div><dt>对进度 ≥ {DEFAULT_HIGH_PROGRESS_PERCENT}% 的高进度电机控机</dt><dd>{generated.verification.keyGeneratorInterruptions} 次</dd></div>
              <div><dt>最终永久减员</dt><dd>{generated.verification.totalEliminations} 人</dd></div>
            </dl>
          </div>
          <label className="generated-json">
            <span>生成的 JSON</span>
            <textarea readOnly rows={12} value={generated.source} />
          </label>
        </div>
      )}
    </section>
  );
}
