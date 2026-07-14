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
          <p className="section-kicker">事件证据</p>
          <h2 id="timeline-title">对局时间线</h2>
        </div>
        <p className="section-note">高亮节点参与了主要断点判断 · 点击查看详情</p>
      </div>
      {items.length === 0 ? (
        <p className="empty-state">当前日志没有可展示的关键时间线事件。</p>
      ) : (
        <div className="timeline-scroll" tabIndex={0} aria-label="可横向滚动的事件时间线">
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
                  <strong>{item.label}</strong>
                  <small>{item.summary}</small>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
      {selectedItem && (
        <article className="event-detail" aria-live="polite">
          <div>
            <span className={`event-detail__kind event-detail__kind--${selectedItem.kind}`}>{selectedItem.label}</span>
            <strong>{selectedItem.timeLabel}</strong>
            <code>{selectedItem.eventId}</code>
          </div>
          <dl>
            {selectedItem.details.map((detail) => (
              <div key={detail.label}>
                <dt>{detail.label}</dt>
                <dd>{detail.value}</dd>
              </div>
            ))}
          </dl>
        </article>
      )}
    </section>
  );
}
