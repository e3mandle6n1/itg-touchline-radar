import { BALL_SPEED } from "./constants.js";
import { clampPitch } from "./util.js";

export function travelMs(from, to, speed = BALL_SPEED) {
  if (!from || !to) return 0;
  const gap = Math.hypot(to.x - from.x, to.y - from.y);
  if (gap < 0.4) return 50;
  return Math.round((gap / speed) * 1000) + 40;
}

export function goalNetTarget(event) {
  const kind = event?.incident || event?.type;
  if (kind !== "goal" || !event?.team) return null;
  const shotY = event.y != null ? Number(event.y) : 50;
  const netY = Math.max(44, Math.min(56, shotY * 0.4 + 50 * 0.6));
  if (event.team === "away") return { x: 1.5, y: netY };
  return { x: 98.5, y: netY };
}

export function shotFlightTarget(event) {
  const kind = event?.incident || event?.type;
  if (kind !== "shotontarget" && kind !== "shotofftarget") return null;
  if (!event?.team || event.x == null || event.y == null) return null;
  const home = event.team !== "away";
  const oy = clampPitch(event.y);

  if (kind === "shotontarget") {
    const saveY = Math.max(42, Math.min(58, oy * 0.35 + 50 * 0.65));
    return home ? { x: 97.2, y: saveY } : { x: 2.8, y: saveY };
  }

  const missHigh = oy < 50;
  const wideY = missHigh
    ? Math.max(6, Math.min(26, oy - 20))
    : Math.min(94, Math.max(74, oy + 20));
  return home ? { x: 99.2, y: wideY } : { x: 0.8, y: wideY };
}

export function shotOrigin(event) {
  if (event?.x == null || event?.y == null) return null;
  return { x: clampPitch(event.x), y: clampPitch(event.y) };
}

export function isShotAttempt(event) {
  const kind = event?.incident || event?.type;
  return kind === "shotontarget" || kind === "shotofftarget";
}

function isKeeperSavePhrase(text) {
  return /keeper\s+sav|goalkeeper\s+sav|makes?\s+a\s+save/i.test(String(text || ""));
}

export function saveSpot(event) {
  const kind = event?.incident || event?.type;
  if (kind !== "goalkeeper_saved" || !event?.team) return null;
  const home = event.team !== "away";
  const oy = event.y != null ? clampPitch(event.y) : 50;
  const saveY = Math.max(40, Math.min(60, oy * 0.35 + 50 * 0.65));
  return home ? { x: 3.5, y: saveY } : { x: 96.5, y: saveY };
}

export function promoteKeeperSaves(row) {
  const kind = row?.incident || row?.type;
  if (kind !== "shotontarget" || !isKeeperSavePhrase(row?.text)) return row;
  if (row.team !== "home" && row.team !== "away") return row;
  const keeper = row.team === "away" ? "home" : "away";
  return {
    ...row,
    type: "goalkeeper_saved",
    incident: "goalkeeper_saved",
    team: keeper,
  };
}

export function centreSpot(event) {
  const kind = event?.incident || event?.type;
  if (kind === "periodstart" || kind === "kickoff") return { x: 50, y: 50 };
  return null;
}

export function isRestart(event) {
  const kind = event?.incident || event?.type;
  return kind === "periodstart" || kind === "kickoff";
}
