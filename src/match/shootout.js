import { clampPitch } from "./util.js";

/** Betradar LMT always takes pens from the left spot. */
export const PEN_SPOT = Object.freeze({ x: 11.5, y: 50 });

const KICK_KINDS = new Set(["goal", "shotontarget", "shotofftarget", "goalkeeper_saved"]);

function periodBlob(event) {
  return `${event?.period || ""} ${event?.periodType || ""} ${event?.phase || ""} ${event?.clock || ""} ${event?.text || ""}`.toLowerCase();
}

export function isShootoutPeriod(event) {
  if (!event) return false;
  if (event.shootout === true) return true;
  const period = String(event.period || event.periodType || event.phase || "").toLowerCase();
  if (period === "penalties" || period === "pen" || period === "pso") return true;
  return /penalty\s*shoot|shoot-?out|\bPSO\b|penalties\s+to\s+(decide|win)|we go to a penalty/i.test(periodBlob(event));
}

export function isShootoutPeriodStart(event) {
  const kind = event?.incident || event?.type;
  if (kind !== "periodstart" && kind !== "kickoff") return false;
  return isShootoutPeriod(event) || /penalt/i.test(String(event?.clock || ""));
}

export function isShootoutKick(event) {
  if (!event) return false;
  const kind = event.incident || event.type;
  if (!KICK_KINDS.has(kind)) return false;
  return isShootoutPeriod(event);
}

export function isShootoutScored(event) {
  if (!isShootoutKick(event)) return false;
  const kind = event.incident || event.type;
  return kind === "goal";
}

export function isShootoutMissed(event) {
  if (!isShootoutKick(event)) return false;
  return !isShootoutScored(event);
}

export function shootoutSpot() {
  return { ...PEN_SPOT };
}

export function shootoutNetTarget() {
  return { x: 1.5, y: 50 };
}

export function shootoutMissTarget(event) {
  const oy = event?.y != null ? clampPitch(event.y) : 50;
  const missHigh = oy < 50;
  const wideY = missHigh
    ? Math.max(8, Math.min(28, oy - 18))
    : Math.min(92, Math.max(72, oy + 18));
  return { x: 0.8, y: wideY };
}

export function shootoutKickResult(event) {
  if (!isShootoutKick(event)) return null;
  return isShootoutScored(event) ? "scored" : "missed";
}

/** Completed kicks up to `throughIndex` (inclusive). */
export function shootoutAttempts(playTrack, throughIndex = -1) {
  if (!Array.isArray(playTrack) || throughIndex < 0) {
    return { home: [], away: [] };
  }
  const home = [];
  const away = [];
  const end = Math.min(throughIndex, playTrack.length - 1);
  for (let i = 0; i <= end; i += 1) {
    const row = playTrack[i];
    if (!isShootoutKick(row)) continue;
    const result = shootoutKickResult(row);
    if (row.team === "away") away.push(result);
    else if (row.team === "home") home.push(result);
  }
  return { home, away };
}

export function shootoutTally(playTrack, throughIndex = -1, slots = 5) {
  const { home, away } = shootoutAttempts(playTrack, throughIndex);
  const maxTaken = Math.max(home.length, away.length);

  // Past the first five: one dot each for the current sudden-death round only.
  if (maxTaken > slots) {
    const round = maxTaken;
    const i = round - 1;
    return {
      home: [home[i] ?? null],
      away: [away[i] ?? null],
      slots: 1,
      suddenDeath: true,
      round,
    };
  }

  const pad = (list) => {
    const out = list.slice(0, slots);
    while (out.length < slots) out.push(null);
    return out;
  };
  return {
    home: pad(home),
    away: pad(away),
    slots,
    suddenDeath: false,
    round: null,
  };
}

export function firstShootoutTeam(playTrack) {
  if (!Array.isArray(playTrack)) return "home";
  for (const row of playTrack) {
    if (isShootoutKick(row) && (row.team === "home" || row.team === "away")) {
      return row.team;
    }
  }
  return "home";
}

export function isInShootout(playTrack, index) {
  if (!Array.isArray(playTrack) || index < 0) return false;
  const end = Math.min(index, playTrack.length - 1);
  let seen = false;
  for (let i = 0; i <= end; i += 1) {
    const row = playTrack[i];
    const kind = row?.incident || row?.type;
    if (isShootoutPeriodStart(row) || isShootoutKick(row)) seen = true;
    if (seen && kind === "match_ended") return i === end;
  }
  return seen;
}
