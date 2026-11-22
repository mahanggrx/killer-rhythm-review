import { useState, type FormEvent } from "react";
import { english } from "../i18n/english";
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
    firstChaseStartSeconds: String(input.firstChaseStartSeconds),
    averageChaseDurationSeconds: String(input.averageChaseDurationSeconds),
    generatorsRemainingAtFirstElimination: String(
      input.generatorsRemainingAtFirstElimination,
    ),
    completeChaseCount: input.completeChaseCount === undefined
      ? ""
      : String(input.completeChaseCount),
    firstChaseDurationSeconds:
      input.firstChaseDurationSeconds === undefined
        ? ""
        : String(input.firstChaseDurationSeconds),
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
      firstChaseStartSeconds: parseFormNumber(values.firstChaseStartSeconds),
      averageChaseDurationSeconds: parseFormNumber(
        values.averageChaseDurationSeconds,
      ),
      generatorsRemainingAtFirstElimination: parseFormNumber(
        values.generatorsRemainingAtFirstElimination,
      ),
      completeChaseCount: parseOptionalFormNumber(values.completeChaseCount),
      firstChaseDurationSeconds: parseOptionalFormNumber(
        values.firstChaseDurationSeconds,
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
          <p className="section-kicker">Synthetic Log Builder</p>
          <h2 id="generator-title">Generate a Test Match from Metrics</h2>
          <p>
            Set three core values. Advanced options are optional; each generated log is validated and recalculated before analysis.
          </p>
        </div>
        <button className="button button--secondary" type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form className="generator-form" onSubmit={handleSubmit}>
        <label className="field-control">
          <span>Time to First Chase (sec)</span>
          <input
            aria-label="Time to First Chase (sec)"
            type="number"
            min={SYNTHETIC_LOG_LIMITS.minimumSeconds}
            max={SYNTHETIC_LOG_LIMITS.maximumSeconds}
            step="1"
            value={values.firstChaseStartSeconds}
            onChange={(event) => updateValue("firstChaseStartSeconds", event.target.value)}
          />
        </label>
        <label className="field-control">
          <span>Average Chase Duration (sec)</span>
          <input
            aria-label="Average Chase Duration (sec)"
            type="number"
            min={SYNTHETIC_LOG_LIMITS.minimumAverageChaseSeconds}
            max={SYNTHETIC_LOG_LIMITS.maximumSeconds}
            step="1"
            value={values.averageChaseDurationSeconds}
            onChange={(event) => updateValue("averageChaseDurationSeconds", event.target.value)}
          />
        </label>
        <label className="field-control">
          <span>Generators Left at First Elimination</span>
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
            <span>Advanced Settings</span>
            <small>Leave blank to use deterministic defaults</small>
          </summary>
          <div className="generator-advanced__grid">
            <label className="field-control">
              <span>Completed Chase Count</span>
              <input
                aria-label="Completed Chase Count"
                type="number"
                min={SYNTHETIC_LOG_LIMITS.minimumCompleteChases}
                max={SYNTHETIC_LOG_LIMITS.maximumCompleteChases}
                step="1"
                placeholder="Auto"
                value={values.completeChaseCount}
                onChange={(event) => updateValue("completeChaseCount", event.target.value)}
              />
              <small className="field-control__help">
                Only chases with confirmed start and end events count.
              </small>
            </label>
            <label className="field-control">
              <span>First Chase Duration (sec)</span>
              <input
                aria-label="First Chase Duration (sec)"
                type="number"
                min={SYNTHETIC_LOG_LIMITS.minimumFirstChaseSeconds}
                max={SYNTHETIC_LOG_LIMITS.maximumSeconds}
                step="1"
                placeholder="Auto"
                value={values.firstChaseDurationSeconds}
                onChange={(event) => updateValue(
                  "firstChaseDurationSeconds",
                  event.target.value,
                )}
              />
              <small className="field-control__help">
                Optional. Allows the first chase to differ from the overall average.
              </small>
            </label>
            <label className="field-control">
              <span>Lost or Switched Chase Count</span>
              <input
                aria-label="Lost or Switched Chases"
                type="number"
                min={SYNTHETIC_LOG_LIMITS.minimumAbandonedChases}
                max={SYNTHETIC_LOG_LIMITS.maximumCompleteChases}
                step="1"
                placeholder="Auto"
                value={values.abandonedChaseCount}
                onChange={(event) => updateValue("abandonedChaseCount", event.target.value)}
              />
              <small className="field-control__help">
                Count chases ended by lost line of sight, range break, locker entry, or target switch.
              </small>
            </label>
            <label className="field-control">
              <span>Generators completed after reaching {DEFAULT_HIGH_PROGRESS_PERCENT}% without interference</span>
              <input
                aria-label={`Generators completed at ${DEFAULT_HIGH_PROGRESS_PERCENT}% without interference`}
                type="number"
                min="0"
                max={SYNTHETIC_LOG_LIMITS.maximumHighProgressGeneratorLosses}
                step="1"
                placeholder="Auto"
                value={values.highProgressGeneratorLosses}
                onChange={(event) => updateValue(
                  "highProgressGeneratorLosses",
                  event.target.value,
                )}
              />
              <small className="field-control__help">
                Interference requires an actual progress loss, regression, or block. Count each generator once if it completes after reaching {DEFAULT_HIGH_PROGRESS_PERCENT}% without further interference.
              </small>
            </label>
            <label className="field-control">
              <span>Killer interference actions on generators at ≥ {DEFAULT_HIGH_PROGRESS_PERCENT}%</span>
              <input
                aria-label={`Killer interference actions at ≥ ${DEFAULT_HIGH_PROGRESS_PERCENT}%`}
                type="number"
                min="0"
                max={SYNTHETIC_LOG_LIMITS.maximumKeyGeneratorInterruptions}
                step="1"
                placeholder="Auto"
                value={values.keyGeneratorInterruptions}
                onChange={(event) => updateValue(
                  "keyGeneratorInterruptions",
                  event.target.value,
                )}
              />
              <small className="field-control__help">
                Count actual Killer interference once per action, even if it applies multiple effects. Survivors stopping repairs does not count.
              </small>
            </label>
            <label className="field-control">
              <span>Total Eliminations</span>
              <input
                aria-label="Total Eliminations"
                type="number"
                min={SYNTHETIC_LOG_LIMITS.minimumEliminations}
                max={SYNTHETIC_LOG_LIMITS.maximumEliminations}
                step="1"
                placeholder="Auto"
                value={values.totalEliminations}
                onChange={(event) => updateValue("totalEliminations", event.target.value)}
              />
              <small className="field-control__help">
                Sacrifice, kill, and bleed-out count. Escapes and bot takeovers do not.
              </small>
            </label>
          </div>
        </details>

        <div className="generator-form__action">
          <button className="button button--primary" type="submit">
            <Icon name="pulse" />Generate & Analyze
          </button>
          <p>Advanced fields are optional. Synthetic logs are for testing rules, not real match reconstruction.</p>
        </div>
      </form>

      {errors.length > 0 && (
        <div className="generator-errors" role="alert">
          <Icon name="warning" />
          <ul>{errors.map((error) => <li key={error}>{english(error)}</li>)}</ul>
        </div>
      )}

      {generated && (
        <div className="generator-output">
          <div className="generator-verification">
            <p><Icon name="check" />Log Validated & Metrics Recalculated</p>
            <dl>
              <div><dt>Time to First Chase</dt><dd>{generated.verification.firstChaseStartSeconds} sec</dd></div>
              <div><dt>Average Chase</dt><dd>{formatVerificationValue(generated.verification.averageChaseDurationSeconds)} sec</dd></div>
              <div><dt>Generators Left at First Elimination</dt><dd>{generated.verification.generatorsRemainingAtFirstElimination}</dd></div>
              <div><dt>Completed Chases</dt><dd>{generated.verification.completeChaseCount} chases</dd></div>
              <div><dt>First Chase Duration</dt><dd>{generated.verification.firstChaseDurationSeconds} sec</dd></div>
              <div><dt>Average Chase Gap</dt><dd>{formatVerificationValue(generated.verification.averageChaseGapSeconds)} sec</dd></div>
              <div><dt>Lost/Switched Chases</dt><dd>{generated.verification.abandonedChaseCount} chases</dd></div>
              <div><dt>Generators completed at ≥ {DEFAULT_HIGH_PROGRESS_PERCENT}% without interference</dt><dd>{generated.verification.highProgressGeneratorLosses} generators</dd></div>
              <div><dt>Interference actions at ≥ {DEFAULT_HIGH_PROGRESS_PERCENT}%</dt><dd>{generated.verification.keyGeneratorInterruptions} chases</dd></div>
              <div><dt>Total Eliminations</dt><dd>{generated.verification.totalEliminations} Survivors</dd></div>
            </dl>
          </div>
          <label className="generated-json">
            <span>Generated JSON</span>
            <textarea readOnly rows={12} value={generated.source} />
          </label>
        </div>
      )}
    </section>
  );
}
