#!/usr/bin/env node
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function resolveTargets(targets) {
  if (!targets.length) return [join(root, "feeds/match.json")];
  const out = [];
  for (const target of targets) {
    const abs = join(root, target);
    const st = statSync(abs);
    if (st.isDirectory()) {
      for (const name of readdirSync(abs)) {
        if (!name.endsWith(".json") || name === "index.json") continue;
        out.push(join(abs, name));
      }
    } else {
      out.push(abs);
    }
  }
  return out;
}

const paths = resolveTargets(process.argv.slice(2));

const INCIDENT = new Set([
  "goal",
  "card",
  "substitution",
  "corner",
  "shotontarget",
  "shotofftarget",
  "shotblocked",
  "goalkeeper_saved",
  "offside",
  "injury",
  "freekick",
  "freekick_taken",
  "throwin",
  "goal_kick",
  "periodstart",
  "periodscore",
  "match_ended",
  "kickoff",
]);

const CENTRE = { x: 50, y: 50 };

function clamp(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  if (n <= 2) return 6;
  if (n >= 98) return 94;
  return Math.max(6, Math.min(94, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOut(t) {
  return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
}

function clockOf(minute, added = 0) {
  if (minute == null) return "";
  return added ? `${minute}'+${added}` : `${minute}'`;
}

function splitTime(t) {
  const whole = Math.max(0, Math.floor(t));
  const added = Math.round((t - whole) * 100);
  return { minute: whole, added, clock: clockOf(whole, added) };
}

function phaseFor(team, x, type) {
  if (["shotontarget", "shotofftarget", "shotblocked", "corner", "goalkeeper_saved", "goal"].includes(type)) {
    return "dangerous";
  }
  if (type === "goal_kick" || type === "periodstart" || type === "periodscore" || type === "match_ended") {
    return "safe";
  }
  if (!team || (team !== "home" && team !== "away")) return "safe";
  const depth = team === "home" ? x : 100 - x;
  if (depth >= 70) return "dangerous";
  if (depth >= 45) return "attack";
  return "safe";
}

function timeKey(event) {
  if (event.type === "periodstart" && /1st|first/i.test(event.clock || event.text || "")) return 0;
  if (event.type === "periodscore" && /1st|first/i.test(event.clock || event.text || "")) return 45.55;
  if (event.type === "periodstart" && /2nd|second/i.test(event.clock || event.text || "")) return 45.6;
  if (event.type === "periodscore" && /full/i.test(event.clock || event.text || "")) return 200;
  if (event.type === "match_ended") return 201;
  if (event.minute == null) return 0;
  return event.minute + (event.added || 0) / 100;
}

function fixPeriodBoundaries(events) {
  const out = events.slice();
  const scoreAt = out.findIndex(
    (e) => e.type === "periodscore" && /1st|first/i.test(e.clock || e.text || ""),
  );
  const startAt = out.findIndex(
    (e) => e.type === "periodstart" && /2nd|second/i.test(e.clock || e.text || ""),
  );
  if (scoreAt < 0 || startAt < 0 || scoreAt >= startAt - 1) return out;
  const [row] = out.splice(scoreAt, 1);
  const insertAt = out.findIndex(
    (e) => e.type === "periodstart" && /2nd|second/i.test(e.clock || e.text || ""),
  );
  out.splice(insertAt, 0, row);
  return out;
}

function spot(event, overrides = {}) {
  const x = clamp(overrides.x ?? event.x ?? 50);
  const y = clamp(overrides.y ?? event.y ?? 50);
  const team = overrides.team ?? event.team;
  const type = overrides.type ?? event.type;
  const minute = overrides.minute ?? event.minute;
  const added = overrides.added ?? event.added ?? 0;
  const row = {
    minute,
    added,
    clock: overrides.clock ?? event.clock ?? clockOf(minute, added),
    team,
    phase: overrides.phase ?? phaseFor(team, x, type),
    x,
    y,
  };
  if (overrides.incident) {
    row.incident = overrides.incident;
    if (event.player) row.player = event.player;
    if (event.text) row.text = event.text;
    if (event.card) row.card = event.card;
    if (event.shootout === true) row.shootout = true;
    if (event.period) row.period = event.period;
  }
  return row;
}

function hash01(n) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** Short pass targets between two spots — zig-zag so the ball looks exchanged. */
function passTargets(a, b, opening = false) {
  const ax = clamp(a.x);
  const ay = clamp(a.y);
  const bx = clamp(b.x);
  const by = clamp(b.y);
  const dist = Math.hypot(bx - ax, by - ay);
  if (dist < 4) return [];

  const stride = opening ? 9 : 12;
  const passes = Math.max(2, Math.min(opening ? 10 : 7, Math.round(dist / stride)));
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const seed = Math.round(ax * 17 + ay * 31 + bx * 13 + by * 7);
  const pts = [];

  for (let i = 1; i < passes; i += 1) {
    const u = i / passes;
    const along = easeInOut(u);
    const side = i % 2 === 0 ? 1 : -1;
    const wobble = (opening ? 7.5 : 5.5) * side * (0.55 + 0.45 * hash01(seed + i));
    const drift = (hash01(seed + i * 3) - 0.5) * (opening ? 4 : 2.5);
    pts.push({
      x: clamp(lerp(ax, bx, along) + nx * wobble + nx * drift * 0.3),
      y: clamp(lerp(ay, by, along) + ny * wobble + ny * drift),
      team: u < 0.72 ? (a.team || b.team) : (b.team || a.team),
    });
  }
  return pts;
}

function samplePass(from, to, fromT, toT, teamHold) {
  const ax = clamp(from.x);
  const ay = clamp(from.y);
  const bx = clamp(to.x);
  const by = clamp(to.y);
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(2, Math.min(6, Math.round(dist / 4.5)));
  const out = [];
  const tEnd = Math.max(fromT + 0.008, toT);

  for (let i = 1; i <= steps; i += 1) {
    const u = easeInOut(i / steps);
    const team = i < steps ? teamHold : (to.team || teamHold);
    const x = lerp(ax, bx, u);
    const y = lerp(ay, by, u);
    const { minute, added, clock } = splitTime(lerp(fromT, tEnd, u));
    out.push(spot(from, {
      team,
      x,
      y,
      minute,
      added,
      clock,
      type: "match_action",
      phase: phaseFor(team, clamp(x), "match_action"),
    }));
  }
  return out;
}

function interpolate(a, b, fromT, toT, opts = {}) {
  const opening = Boolean(opts.opening);
  const ax = clamp(a.x);
  const ay = clamp(a.y);
  const bx = clamp(b.x);
  const by = clamp(b.y);
  const dist = Math.hypot(bx - ax, by - ay);
  if (dist < 3.2) return [];

  const targets = passTargets(a, b, opening);
  const chain = [
    { x: ax, y: ay, team: a.team },
    ...targets,
    { x: bx, y: by, team: b.team || a.team },
  ];
  const tEnd = Math.max(fromT + 0.02, toT);
  const out = [];

  for (let i = 0; i < chain.length - 1; i += 1) {
    const segFrom = chain[i];
    const segTo = chain[i + 1];
    const segStart = lerp(fromT, tEnd, i / (chain.length - 1));
    const segEnd = lerp(fromT, tEnd, (i + 1) / (chain.length - 1));
    const hold = segFrom.team || a.team;
    // Drop the last sample of each pass so the next pass start isn't duplicated.
    const samples = samplePass(segFrom, segTo, segStart, segEnd, hold);
    out.push(...samples.slice(0, -1));
  }
  return out;
}

/** After kick-off, work the ball through midfield before the first restart. */
function kickoffBuild(from, to, fromT, toT) {
  const bx = clamp(to.x);
  const by = clamp(to.y);
  const team = from.team || to.team || "home";
  const towardTouch = by < 50 ? 1 : -1;
  const midY = 50 + towardTouch * 8;
  const mid = [
    { x: 50 + (team === "away" ? -6 : 6), y: midY, team },
    { x: 46 + (team === "away" ? -8 : 10), y: midY + towardTouch * 6, team },
    { x: lerp(50, bx, 0.45), y: lerp(50, by, 0.35), team },
    { x: lerp(50, bx, 0.72), y: lerp(50, by, 0.7), team },
  ];

  const tMid = fromT + Math.max(0.35, (toT - fromT) * 0.55);
  const out = [];
  let prev = { ...from, x: 50, y: 50, team };
  let prevTime = fromT;

  for (let i = 0; i < mid.length; i += 1) {
    const next = mid[i];
    const t = lerp(fromT, tMid, (i + 1) / mid.length);
    out.push(...interpolate(prev, next, prevTime, t, { opening: true }));
    const shown = splitTime(t);
    out.push(spot(next, {
      team: next.team,
      x: next.x,
      y: next.y,
      minute: shown.minute,
      added: shown.added,
      clock: shown.clock,
      type: "match_action",
      phase: phaseFor(next.team, clamp(next.x), "match_action"),
    }));
    prev = next;
    prevTime = t;
  }

  out.push(...interpolate(prev, to, prevTime, toT, { opening: true }));
  return out;
}

function enrichFile(path) {
  const match = JSON.parse(readFileSync(path, "utf8"));

  match.events = fixPeriodBoundaries(match.events)
    .map((event, index) => ({ event, index, key: timeKey(event) + index / 1e6 }))
    .sort((a, b) => a.key - b.key)
    .map(({ event }) => event);

  const feed = match.events
    .map((event, index) => ({ event, index }))
    .filter(({ event }) => INCIDENT.has(event.type) || (event.x != null && event.y != null));

  const situations = [];
  let prev = null;
  let prevT = -0.01;
  let lastBall = { x: 50, y: 50, team: "home" };

  for (const { event } of feed) {
    if (prev?.type === "match_ended") break;

    const isPeriodStart = event.type === "periodstart";
    const hasPitch = event.x != null && event.y != null;
    const x = isPeriodStart ? CENTRE.x : hasPitch ? clamp(event.x) : lastBall.x;
    const y = isPeriodStart ? CENTRE.y : hasPitch ? clamp(event.y) : lastBall.y;
    const team = event.team || lastBall.team;

    let t = timeKey(event);
    if (t < prevT) t = prevT + 0.02;

    const cur = { ...event, x, y, team };

    if (prev) {
      const fromKickoff = prev.type === "periodstart" || prev.type === "kickoff";
      const toRestart = ["throwin", "goal_kick", "corner", "freekick", "freekick_taken"].includes(event.type);
      if (fromKickoff && toRestart) {
        situations.push(...kickoffBuild(prev, cur, prevT, Math.max(prevT + 0.55, t)));
      } else {
        situations.push(...interpolate(prev, cur, prevT, t, { opening: fromKickoff }));
      }
    }

    const incident = INCIDENT.has(event.type) ? event.type : undefined;
    let shown;
    if (event.type === "periodstart" || event.type === "periodscore" || event.type === "match_ended") {
      const fallback = splitTime(t);
      shown = {
        minute: event.minute ?? fallback.minute,
        added: event.added || 0,
        clock: event.clock || fallback.clock,
      };
    } else {
      const sourceT = event.minute != null ? timeKey(event) : null;
      const useSource = sourceT != null && sourceT >= prevT - 0.001;
      shown = useSource
        ? { minute: event.minute, added: event.added || 0, clock: event.clock || clockOf(event.minute, event.added || 0) }
        : splitTime(t);
    }

    situations.push(spot(cur, {
      incident,
      minute: shown.minute,
      added: shown.added,
      clock: shown.clock,
      phase: isPeriodStart ? "safe" : phaseFor(team, x, event.type),
    }));

    prev = cur;
    prevT = t;
    lastBall = { x, y, team };

    if (event.type === "goal" && event.shootout !== true) {
      const kickTeam = event.team === "away" ? "home" : "away";
      const kickT = prevT + 0.12;
      const kickShown = splitTime(kickT);
      const kickCur = {
        type: "kickoff",
        team: kickTeam,
        x: CENTRE.x,
        y: CENTRE.y,
      };
      situations.push(...interpolate(prev, kickCur, prevT, kickT));
      situations.push(spot(kickCur, {
        incident: "kickoff",
        minute: kickShown.minute,
        added: kickShown.added,
        clock: kickShown.clock,
        phase: "safe",
        team: kickTeam,
        x: CENTRE.x,
        y: CENTRE.y,
      }));
      prev = kickCur;
      prevT = kickT;
      lastBall = { x: CENTRE.x, y: CENTRE.y, team: kickTeam };
    }
  }

  const deduped = [];
  for (const row of situations) {
    const prevRow = deduped[deduped.length - 1];
    if (
      prevRow
      && prevRow.team === row.team
      && prevRow.phase === row.phase
      && !row.incident
      && !prevRow.incident
      && Math.hypot(prevRow.x - row.x, prevRow.y - row.y) < 1.8
    ) {
      continue;
    }
    deduped.push(row);
  }

  match.situations = deduped;
  writeFileSync(path, `${JSON.stringify(match)}\n`);

  console.log(`${path}: situations ${deduped.length} from ${feed.length} events`);
}

for (const path of paths) enrichFile(path);
