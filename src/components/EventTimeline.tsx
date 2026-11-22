import { english } from "../i18n/english";
import type { TimelineItem } from "../domain/timeline";

interface EventTimelineProps {
  items: readonly TimelineItem[];
  selectedEventId: string | null;
  onSelect: (eventId: string) => void;
}

export function EventTimeline({ items, selectedEventId, onSelect }: EventTimelineProps) {
  const selectedItem = items.find((item) => item.eventId === selectedEventId) ?? null;

  return (
    <section className="timeline-section" id="evidence-timeline" aria-labelledby="timeline-title">
      <div className="section-heading">
        <div>
          <p className="section-kicker">Event Evidence</p>
          <h2 id="timeline-title">Match Timeline</h2>
        </div>
        <p className="section-note">Highlighted events support the main finding · Tap to inspect</p>
      </div>
      {items.length === 0 ? (
        <p className="empty-state">No timeline events available for this log.</p>
      ) : (
        <div className="timeline-scroll" tabIndex={0} aria-label="Horizontally scrollable match timeline">
          <ol className="timeline-list">
            {items.map((item) => (
              <li className="timeline-item" key={item.eventId}>
                <button
                  type="button"
                  className={`timeline-event timeline-event--${item.kind}${item.isEvidence ? " is-evidence" : ""}${selectedEventId === item.eventId ? " is-selected" : ""}`}
                  onClick={() => onSelect(item.eventId)}
                  aria-pressed={selectedEventId === item.eventId}
                >
                  <span className="timeline-event__time">{item.timeLabel}</span>
                  <span className="timeline-event__node" aria-hidden="true" />
                  <strong>{english(item.label)}</strong>
                  <small>{english(item.summary)}</small>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {selectedItem && (
        <article className="event-detail" aria-live="polite">
          <div>
            <span className={`event-detail__kind event-detail__kind--${selectedItem.kind}`}>{english(selectedItem.label)}</span>
            <strong>{selectedItem.timeLabel}</strong>
            <code>{selectedItem.eventId}</code>
          </div>
          <dl>
            {selectedItem.details.map((detail) => (
              <div key={english(detail.label)}>
                <dt>{english(detail.label)}</dt>
                <dd>{english(detail.value)}</dd>
              </div>
            ))}
          </dl>
        </article>
      )}
    </section>
  );
}
