import { clampPitch, attackDepth, eventKind, clockKey, ATTACK_FROM } from "./util.js";
import { travelMs } from "./ball.js";

function isCornerTake(event) {
  if (eventKind(event) !== "corner") return false;
  const text = String(event?.text || "").toLowerCase();
  return /\btakes?\s+a\s+corner\b|\bcorner\s+from\s+the\b|\btake[ns]\s+the\s+corner\b/.test(text);
}

function isFreeKickTake(event) {
  const kind = eventKind(event);
  if (kind === "freekick_taken") return true;
  if (kind !== "freekick") return false;
  const text = String(event?.text || "").toLowerCase();
  return /\btakes?\s+(the\s+)?free[- ]?kick\b|\bfree[- ]?kick\s+is\s+taken\b|\bchance is wasted\b/.test(text);
}

function isCornerKickMoment(event) {
  if (eventKind(event) !== "corner") return false;
  if (event.cornerKick === true) return true;
  if (event.cornerKick === false) return false;
  return isCornerTake(event);
}

function isFreeKickMoment(event) {
  const kind = eventKind(event);
  if (kind !== "freekick" && kind !== "freekick_taken") return false;
  if (event.freeKick === true) return true;
  if (event.freeKick === false) return false;
  return isFreeKickTake(event);
}

const GOALLINE = { left: 1.5, right: 98.5 };
const TOUCHLINE = { top: (1.5 / 64) * 100, bottom: (62.5 / 64) * 100 };

function cornerFlagTarget(event) {
  if (eventKind(event) !== "corner" || !event?.team) return null;
  const top = (event.y ?? 50) < 50;
  const y = top ? TOUCHLINE.top : TOUCHLINE.bottom;
  if (event.team === "away") return { x: GOALLINE.left, y };
  return { x: GOALLINE.right, y };
}

export function throwInSpot(event) {
  if (eventKind(event) !== "throwin" || event?.x == null) return null;
  const x = Math.min(GOALLINE.right, Math.max(GOALLINE.left, event.x));
  const y = (event.y ?? 50) < 50 ? TOUCHLINE.top : TOUCHLINE.bottom;
  return { x, y };
}

function freeKickSpot(event) {
  const kind = eventKind(event);
  if (kind !== "freekick" && kind !== "freekick_taken") return null;
  if (event?.x == null || event?.y == null) return null;
  return { x: clampPitch(event.x), y: clampPitch(event.y) };
}

export function dedupeCornerAwards(playTrack) {
  const out = [];
  for (const row of playTrack) {
    const prev = out[out.length - 1];
    if (
      prev
      && eventKind(prev) === "corner"
      && eventKind(row) === "corner"
      && prev.team === row.team
      && prev.minute === row.minute
      && (prev.added || 0) === (row.added || 0)
      && !isCornerTake(row)
      && !isCornerTake(prev)
      && Math.hypot((prev.x ?? 50) - (row.x ?? 50), (prev.y ?? 50) - (row.y ?? 50)) < 4
    ) {
      continue;
    }
    out.push(row);
  }
  return out;
}

export function markSetPieces(playTrack) {
  const withCoords = playTrack.map((row, index) => {
    if (eventKind(row) !== "freekick_taken") return row;
    if (row.x != null && row.y != null) return row;
    for (let j = index - 1; j >= 0; j -= 1) {
      const prev = playTrack[j];
      const pk = eventKind(prev);
      if (pk === "periodstart" || pk === "periodscore") break;
      if ((pk === "freekick" || pk === "freekick_taken") && prev.team === row.team && prev.x != null) {
        return { ...row, x: prev.x, y: prev.y };
      }
    }
    return row;
  });

  const tagged = withCoords.map((row) => {
    const kind = eventKind(row);
    if (kind === "corner") {
      return { ...row, cornerKick: true };
    }
    if (kind === "freekick" || kind === "freekick_taken") {
      const depth = attackDepth(row);
      return { ...row, freeKick: depth != null && depth >= ATTACK_FROM };
    }
    return row;
  });

  const linkAwardBeforeTake = (takeIndex, isTakeFn, flagKey, kinds) => {
    const take = tagged[takeIndex];
    const t1 = clockKey(take);
    for (let j = takeIndex - 1; j >= 0; j -= 1) {
      const prev = tagged[j];
      const pk = eventKind(prev);
      if (pk === "periodstart" || pk === "periodscore" || pk === "match_ended") break;
      if (!kinds.has(pk) || prev.team !== take.team) continue;
      if (t1 - clockKey(prev) > 2.75) break;
      if (isTakeFn(prev)) break;
      tagged[j] = { ...tagged[j], [flagKey]: false };
      break;
    }
  };

  for (let i = 0; i < tagged.length; i += 1) {
    const row = tagged[i];
    if (eventKind(row) === "corner" && isCornerTake(row)) {
      linkAwardBeforeTake(i, isCornerTake, "cornerKick", new Set(["corner"]));
    }
    if (
      (eventKind(row) === "freekick" || eventKind(row) === "freekick_taken")
      && isFreeKickTake(row)
    ) {
      linkAwardBeforeTake(
        i,
        isFreeKickTake,
        "freeKick",
        new Set(["freekick", "freekick_taken"]),
      );
    }
  }

  return tagged;
}

export function linkFreeKickCards(playTrack) {
  const out = playTrack.map((row) => ({ ...row }));
  for (let i = 0; i < out.length; i += 1) {
    if (eventKind(out[i]) !== "card") continue;
    const card = out[i];
    if (card.team !== "home" && card.team !== "away") continue;
    const tCard = clockKey(card);

    let best = null;
    for (let j = 0; j < out.length; j += 1) {
      const fk = out[j];
      const kind = eventKind(fk);
      if (kind !== "freekick" && kind !== "freekick_taken") continue;
      if (!fk.team || fk.team === card.team) continue;
      if (fk.x == null || fk.y == null) continue;
      const dt = Math.abs(clockKey(fk) - tCard);
      if (dt > 1.25) continue;
      const dist = Math.abs(j - i);
      if (
        !best
        || dt < best.dt - 0.01
        || (Math.abs(dt - best.dt) <= 0.01 && dist < best.dist)
      ) {
        best = { j, dt, dist, fk };
      }
    }
    if (!best) continue;

    const foulSpot = {
      x: clampPitch(best.fk.x),
      y: clampPitch(best.fk.y),
    };
    out[i] = {
      ...card,
      withFreeKick: true,
      foulSpot,
      foulTeam: best.fk.team,
      x: best.fk.x,
      y: best.fk.y,
    };
    out[best.j] = { ...out[best.j], leadsToCard: true, freeKick: true };
  }
  return out;
}

function cornerDeliveryTarget(event) {
  const flag = cornerFlagTarget(event);
  if (!flag) return null;
  const nearPost = flag.y < 50;
  if (event.team === "away") {
    return { x: 14, y: nearPost ? 36 : 64 };
  }
  return { x: 86, y: nearPost ? 36 : 64 };
}

function freeKickDeliveryTarget(event) {
  const spot = freeKickSpot(event);
  if (!spot || !event?.team) return null;
  if (event.team === "away") {
    return {
      x: Math.max(8, spot.x - 16),
      y: Math.max(28, Math.min(72, spot.y * 0.45 + 50 * 0.55)),
    };
  }
  return {
    x: Math.min(92, spot.x + 16),
    y: Math.max(28, Math.min(72, spot.y * 0.45 + 50 * 0.55)),
  };
}

export function setPieceSpot(event) {
  return cornerFlagTarget(event) || freeKickSpot(event);
}

export function setPieceDeliveryTarget(event) {
  if (eventKind(event) === "corner") return cornerDeliveryTarget(event);
  if (eventKind(event) === "freekick" || eventKind(event) === "freekick_taken") {
    return freeKickDeliveryTarget(event);
  }
  return null;
}

export function isSetPieceKickMoment(event) {
  return isCornerKickMoment(event) || isFreeKickMoment(event);
}

export function setPieceDwellMs(fromBall, event) {
  const spot = setPieceSpot(event);
  if (!spot) return null;
  const kind = eventKind(event);
  if (kind !== "corner" && kind !== "freekick" && kind !== "freekick_taken") return null;
  const from = fromBall || spot;
  const toSpot = travelMs(from, spot);
  if (!isSetPieceKickMoment(event)) {
    const awardHold = event.leadsToCard ? 1100 : (kind === "corner" ? 1400 : 520);
    return toSpot + awardHold;
  }
  const box = setPieceDeliveryTarget(event);
  if (!box) {
    const awardHold = event.leadsToCard ? 1100 : (kind === "corner" ? 1400 : 520);
    return toSpot + awardHold;
  }
  const after = event.leadsToCard ? 1100 : (kind === "corner" ? 900 : 720);
  return toSpot + 280 + travelMs(spot, box) + after;
}

const PITCH_INSET = { x0: 2.2, y0: 2.2, x1: 97.8, y1: 97.8 };

const TIP_ROOM = 24;

function polar(apex, angle, radius) {
  return {
    x: apex.x + Math.cos(angle) * radius,
    y: apex.y + Math.sin(angle) * radius,
  };
}

function rayMaxRadius(apex, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  let max = Infinity;
  if (c > 1e-6) max = Math.min(max, (PITCH_INSET.x1 - apex.x) / c);
  else if (c < -1e-6) max = Math.min(max, (PITCH_INSET.x0 - apex.x) / c);
  if (s > 1e-6) max = Math.min(max, (PITCH_INSET.y1 - apex.y) / s);
  else if (s < -1e-6) max = Math.min(max, (PITCH_INSET.y0 - apex.y) / s);
  return Number.isFinite(max) ? Math.max(0, max) : 0;
}

function clampFunnelRadius(apex, heading, halfAngle, want) {
  const along = rayMaxRadius(apex, heading) * 0.94;
  let soft = along;
  for (const t of [0.2, 0.4, 0.6, 0.75]) {
    soft = Math.min(
      soft,
      rayMaxRadius(apex, heading - halfAngle * t),
      rayMaxRadius(apex, heading + halfAngle * t),
    );
  }
  return Math.max(16, Math.min(want, soft * 0.96, along));
}

function resolveTipSide(apex, heading) {
  const prefer = Math.cos(heading) >= 0 ? "left" : "right";
  const roomLeft = apex.x - PITCH_INSET.x0;
  const roomRight = PITCH_INSET.x1 - apex.x;
  const roomAbove = apex.y - PITCH_INSET.y0;

  if (prefer === "right" && roomRight >= TIP_ROOM) return "right";
  if (prefer === "left" && roomLeft >= TIP_ROOM) return "left";
  if (prefer === "right" && roomLeft >= TIP_ROOM) return "left";
  if (prefer === "left" && roomRight >= TIP_ROOM) return "right";
  return roomAbove >= 14 ? "above" : "below";
}

export function setPieceFunnelPolygon(apex, team, kind = "corner") {
  if (!apex) return null;
  const home = team !== "away";
  const isCorner = kind === "corner";
  const target = isCorner
    ? (home ? { x: 88, y: 50 } : { x: 12, y: 50 })
    : (home ? { x: 97, y: 50 } : { x: 3, y: 50 });
  const heading = Math.atan2(target.y - apex.y, target.x - apex.x);
  const halfAngle = (55 * Math.PI) / 360;
  const want = isCorner
    ? 28
    : home
      ? Math.min(30, Math.max(18, 94 - apex.x))
      : Math.min(30, Math.max(18, apex.x - 6));
  const radius = isCorner
    ? Math.min(want, Math.max(22, rayMaxRadius(apex, heading) * 0.42))
    : clampFunnelRadius(apex, heading, halfAngle, want);

  const a0 = heading - halfAngle;
  const a1 = heading + halfAngle;
  const near = polar(apex, a0, radius);
  const far = polar(apex, a1, radius);
  const mid = polar(apex, heading, radius * 0.55);

  return {
    apex,
    near,
    far,
    mid,
    heading,
    halfAngle,
    radius,
    tipSide: resolveTipSide(apex, heading),
    points: `${apex.x},${apex.y} ${near.x},${near.y} ${far.x},${far.y}`,
    edge: `${near.x},${near.y} ${apex.x},${apex.y} ${far.x},${far.y}`,
  };
}

export function setPieceFunnelBars(poly, steps = 3) {
  if (!poly?.apex || poly.heading == null || !poly.radius) return [];
  const { apex, heading, halfAngle, radius } = poly;
  const a0 = heading - halfAngle;
  const a1 = heading + halfAngle;
  const bars = [];

  for (let i = 0; i < steps; i += 1) {
    const r0 = (radius * i) / steps;
    const r1 = (radius * (i + 1)) / steps;
    const p0inner = polar(apex, a0, Math.max(0.4, r0));
    const p1inner = polar(apex, a1, Math.max(0.4, r0));
    const p0outer = polar(apex, a0, r1);
    const p1outer = polar(apex, a1, r1);
    const large = halfAngle * 2 > Math.PI ? 1 : 0;
    const d = [
      `M ${p0inner.x} ${p0inner.y}`,
      `L ${p0outer.x} ${p0outer.y}`,
      `A ${r1} ${r1} 0 ${large} 1 ${p1outer.x} ${p1outer.y}`,
      `L ${p1inner.x} ${p1inner.y}`,
      r0 < 0.5
        ? `L ${p0inner.x} ${p0inner.y}`
        : `A ${r0} ${r0} 0 ${large} 0 ${p0inner.x} ${p0inner.y}`,
      "Z",
    ].join(" ");

    bars.push({
      index: i,
      d,
          opacity: 0.18 + (i + 1) * 0.14,
    });
  }
  return bars;
}

export function cornerQuad(flag) {
  if (!flag) return "br";
  const top = flag.y < 50;
  const left = flag.x < 50;
  if (top && left) return "tl";
  if (top && !left) return "tr";
  if (!top && left) return "bl";
  return "br";
}
