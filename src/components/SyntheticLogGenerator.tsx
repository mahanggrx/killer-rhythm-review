import { useState, type FormEvent } from "react";
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

function toFormValues(
  input: Readonly<SyntheticLogInput>,
): GeneratorFormValues {
  return {
    averageChaseGapSeconds: String(input.averageChaseGapSeconds),
    firstChaseDurationSeconds: String(input.firstChaseDurationSeconds),
    generatorsRemainingAtFirstElimination: String(
      input.generatorsRemainingAtFirstElimination,
    ),
  };
}

function parseFormNumber(value: string): number {
  return value.trim() === "" ? Number.NaN : Number(value);
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
            填写三个核心结果，系统会生成匿名事件、通过现有校验，并回算确认指标一致。
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

        <div className="generator-form__action">
          <button className="button button--primary" type="submit">
            <Icon name="pulse" />生成并分析
          </button>
          <p>固定生成两段正式追逐和一次流血减员，仅用于规则原型测试。</p>
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
