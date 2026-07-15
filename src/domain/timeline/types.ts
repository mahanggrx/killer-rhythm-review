import type { MatchEventType } from "../log";

export type TimelineEventKind =
  | "match"
  | "chase"
  | "down"
  | "hook"
  | "generator"
  | "elimination";

export interface TimelineDetail {
  label: string;
  value: string;
}

export interface TimelineItem {
  eventId: string;
  eventType: MatchEventType;
  timestampMs: number;
  timeLabel: string;
  positionPercent: number;
  kind: TimelineEventKind;
  label: string;
  summary: string;
  details: TimelineDetail[];
  isEvidence: boolean;
}
