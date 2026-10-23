import { EVENT_LABELS } from "./constants.js";
import { clampPitch, clockLabel, attackDepth, eventKind, possessionPhase, ATTACK_FROM } from "./util.js";
import { holdFor, hasSitover } from "./events.js";
import { travelMs, promoteKeeperSaves } from "./ball.js";
import {
  dedupeCornerAwards,
  markSetPieces,
  linkFreeKickCards,
  setPieceDwellMs,
} from "./setpiece.js";
import { isShootoutPeriodStart } from "./shootout.js";

const SHOOTOUT_KICK_TYPES = new Set([
  "goal",
  "shotontarget",
  "shotofftarget",
  "goalkeeper_saved",
]);

function withShootoutFlags(rows) {
  let inPens = false;
  return rows.map((row) => {
    const kind = row.incident || row.type;
    if (isShootoutPeriodStart(row)) {
      inPens = true;
      return row.shootout === true && row.period
        ? row
        : { ...row, shootout: true, period: row.period || "penalties" };
    }
    if (kind === "match_ended" || kind === "periodscore") {
      if (kind === "match_ended") inPens = false;
      return row;
    }
    if (!inPens) return row;
    if (!SHOOTOUT_KICK_TYPES.has(kind)) return row;
    if (row.shootout === true && row.period) return row;
    return { ...row, shootout: true, period: row.period || "penalties" };
  });
}

function reconcileEventText(event, match) {
  const kind = eventKind(event);
  if (kind !== "throwin" && kind !== "freekick" && kind !== "freekick_taken") return event?.text;
  const depth = attackDepth(event);
  if (depth == null) return event?.text;

  const team = event.team === "away" ? match?.away : match?.home;
  const name = team?.name || (event.team === "away" ? "Away" : "Home");
  const text = String(event.text || "");
  const claimsThreat = /shooting range|dangerous|good position|close to the penalty|outside .+ area|need to be alert|getting dangerous|attacking/i.test(text);

  if (kind === "throwin") {
    return depth < ATTACK_FROM && claimsThreat ? `Throw-in for ${name}.` : event.text;
  }
  if (depth < 48 && claimsThreat) {
    return `${name} awarded a free kick in their own half.`;
  }
  if (depth >= 55 && /own half/i.test(text)) {
    return `Free kick for ${name} in the opposition half.`;
  }
  return event.text;
}

function withReconciledText(rows, match) {
  return rows.map((row) => {
    const text = reconcileEventText(row, match);
    return text === row.text ? row : { ...row, text };
  });
}

function withKeeperSaves(rows) {
  return rows.map(promoteKeeperSaves);
}

export function buildPlayTrack(match) {
  if (match.situations?.length) {
    const rows = match.situations.map((row, index) => ({
      ...row,
      type: row.incident || "match_action",
      order: (row.minute ?? 0) + (row.added || 0) / 100 + index / 1e6,
    }));
    return linkFreeKickCards(
      markSetPieces(
        withShootoutFlags(withReconciledText(withKeeperSaves(dedupeCornerAwards(rows)), match)),
      ),
    );
  }
  return linkFreeKickCards(
    markSetPieces(
      withShootoutFlags(
        withReconciledText(withKeeperSaves(dedupeCornerAwards(buildTimeline(match.events))), match),
      ),
    ),
  );
}

function isTimelineMark(row) {
  if (!row) return false;
  if (row.incident === "kickoff") return false;
  if (row.incident) return true;
  if (row.phase != null) return false;
  if (!row.type || row.type === "match_action") return false;
  return true;
}

export function buildIncidentTimeline(playTrack) {
  const marks = [];
  for (let playIndex = 0; playIndex < playTrack.length; playIndex += 1) {
    const row = playTrack[playIndex];
    if (!isTimelineMark(row)) continue;
    const type = row.incident || row.type;
    marks.push({
      ...row,
      type,
      playIndex,
      text: row.text || EVENT_LABELS[type] || type,
      clock: row.clock || clockLabel(row),
      order: row.order ?? playIndex,
    });
  }
  return marks;
}

export function incidentIndexAtPlay(marks, playIndex) {
  if (!marks.length) return 0;
  let best = 0;
  for (let i = 0; i < marks.length; i += 1) {
    if (marks[i].playIndex <= playIndex) best = i;
    else break;
  }
  return best;
}

/** Marks up to markIndex, newest first for the live caption list. */
export function liveTimelineRows(marks, markIndex) {
  if (!marks?.length || markIndex == null || markIndex < 0) return [];
  const end = Math.min(markIndex, marks.length - 1);
  const rows = [];
  for (let i = 0; i <= end; i += 1) {
    rows.push({ ...marks[i], markIndex: i });
  }
  rows.reverse();
  return rows;
}

function periodMeta(event) {
  const type = event?.incident || event?.type;
  const blob = `${event?.clock || ""} ${event?.text || ""}`;
  if (type === "periodstart") {
    if (/penalt/i.test(blob)) return { id: "pen", label: "Penalties" };
    if (/extra|et\b/i.test(blob) && /2nd|second/i.test(blob)) {
      return { id: "et2", label: "Extra time · 2nd Half" };
    }
    if (/extra|et\b/i.test(blob) && /1st|first/i.test(blob)) {
      return { id: "et1", label: "Extra time · 1st Half" };
    }
    if (/2nd|second/i.test(blob)) return { id: "2h", label: "2nd Half" };
    if (/1st|first/i.test(blob)) return { id: "1h", label: "1st Half" };
  }
  if (type === "periodscore") {
    if (/full|ft|normal/i.test(blob)) return { id: "ft", label: "Full Time", close: true };
    if (/extra|et\b/i.test(blob)) return { id: "et-end", label: "Extra Time", close: true };
    if (/1st|first|half/i.test(blob)) return { id: "ht", label: "Half Time", close: true };
  }
  return null;
}

function scoreThroughMarks(marks, upToInclusive) {
  const score = { home: 0, away: 0 };
  for (let i = 0; i <= upToInclusive && i < marks.length; i += 1) {
    const kind = marks[i].incident || marks[i].type;
    if (kind !== "goal") continue;
    if (marks[i].team === "home") score.home += 1;
    if (marks[i].team === "away") score.away += 1;
  }
  return score;
}

export function groupTimelinePeriods(marks) {
  if (!marks?.length) return [];

  const periods = [];
  let current = null;

  const open = (id, label) => {
    current = { id, label, events: [] };
    periods.push(current);
  };

  for (let i = 0; i < marks.length; i += 1) {
    const mark = marks[i];
    const meta = periodMeta(mark);
    const kind = mark.incident || mark.type;

    if (meta && kind === "periodstart") {
      open(meta.id, meta.label);
      continue;
    }
    if (meta?.close || kind === "match_ended") {
      if (current) current.score = scoreThroughMarks(marks, i - (kind === "match_ended" ? 1 : 0));
      continue;
    }
    if (!current) open("1h", "1st Half");
    current.events.push({ ...mark, markIndex: i });
  }

  for (const period of periods) {
    if (period.score) continue;
    const last = period.events[period.events.length - 1];
    period.score = last
      ? scoreThroughMarks(marks, last.markIndex)
      : { home: 0, away: 0 };
  }

  return periods.slice().reverse();
}

function playbackKey(event, index) {
  if (event.type === "periodstart" && event.clock === "1st half") return -1;
  if (event.type === "periodscore" && /1st|first/i.test(event.clock || event.text || "")) return 45.55;
  if (event.type === "periodstart" && event.clock === "2nd half") return 45.6;
  if (event.type === "periodscore" && event.clock === "Full Time") return 200;
  if (event.type === "match_ended") return 201;
  return (event.minute ?? 0) + (event.added || 0) / 100 + index / 1e6;
}

function buildTimeline(events) {
  return events
    .map((event, index) => ({ ...event, order: playbackKey(event, index) }))
    .sort((a, b) => a.order - b.order);
}

export function situationPhase(event, ball, fromBall) {
  if (hasSitover(event)) return null;
  if (!event?.team || (event.team !== "home" && event.team !== "away")) return null;
  const kind = event.incident || event.type;
  if (
    kind === "periodstart"
    || kind === "periodscore"
    || kind === "match_ended"
    || kind === "kickoff"
    || kind === "backfrominjury"
  ) {
    return null;
  }
  const x = ball?.x ?? (event.x != null ? clampPitch(event.x) : null);
  if (x == null) return null;
  return possessionPhase(event.team, x, fromBall?.x);
}

export function dwellFor(event, fromBall, toBall) {
  const setPieceMs = setPieceDwellMs(fromBall, event);
  if (setPieceMs != null) return setPieceMs;
  return travelMs(fromBall, toBall) + holdFor(event);
}

export function scoreAt(timeline, index) {
  const score = { home: 0, away: 0 };
  for (let i = 0; i <= index; i += 1) {
    const event = timeline[i];
    const kind = event?.incident || event?.type;
    if (kind === "goal" && score[event.team] != null) score[event.team] += 1;
  }
  return score;
}

export function minuteAt(timeline, index, { complete = true } = {}) {
  if (!timeline?.length) return 0;
  const atTip = index >= timeline.length - 1;
  if (complete && atTip) return 200;
  const start = Math.min(Math.max(0, index), timeline.length - 1);
  for (let i = start; i >= 0; i -= 1) {
    if (timeline[i]?.minute != null) return timeline[i].minute;
  }
  return 0;
}

export function ballAt(timeline, index) {
  if (!timeline?.length) return { x: 50, y: 50 };
  const start = Math.min(Math.max(0, index), timeline.length - 1);
  for (let i = start; i >= 0; i -= 1) {
    const event = timeline[i];
    if (event?.x != null && event?.y != null) {
      return { x: clampPitch(event.x), y: clampPitch(event.y) };
    }
  }
  return { x: 50, y: 50 };
}
