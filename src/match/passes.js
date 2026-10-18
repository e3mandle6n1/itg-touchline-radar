const EPSILON = 6;
const MIN_LEN = 6;
const MAX_LEN = 40;

function isOpenPlay(row) {
  return row?.x != null && row?.y != null && !row.incident;
}

function distToSegment(point, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-6) return Math.hypot(point.x - a.x, point.y - a.y);
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(point.x - (a.x + t * dx), point.y - (a.y + t * dy));
}

function simplify(points) {
  if (points.length < 3) return points;
  let max = 0;
  let index = 0;
  const last = points.length - 1;
  for (let i = 1; i < last; i += 1) {
    const dist = distToSegment(points[i], points[0], points[last]);
    if (dist > max) {
      max = dist;
      index = i;
    }
  }
  if (max <= EPSILON) return [points[0], points[last]];
  const left = simplify(points.slice(0, index + 1));
  const right = simplify(points.slice(index));
  return left.slice(0, -1).concat(right);
}

function pushPass(out, from, to) {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len < MIN_LEN || from.i === to.i) return;
  out.push({
    team: to.team,
    from: { x: from.x, y: from.y },
    to: { x: to.x, y: to.y },
    start: from.i,
    end: to.i,
  });
}

function splitLong(run, from, to, out) {
  const len = Math.hypot(to.x - from.x, to.y - from.y);
  if (len > MAX_LEN) {
    const span = run.filter((point) => point.i >= from.i && point.i <= to.i);
    const mid = span[Math.floor(span.length / 2)];
    if (mid && mid.i > from.i && mid.i < to.i) {
      splitLong(run, from, mid, out);
      splitLong(run, mid, to, out);
      return;
    }
  }
  pushPass(out, from, to);
}

function passesInRun(run) {
  const kept = simplify(run);
  const out = [];
  for (let i = 1; i < kept.length; i += 1) {
    splitLong(run, kept[i - 1], kept[i], out);
  }
  return out;
}

export function buildPasses(playTrack) {
  if (!playTrack?.length) return [];
  const passes = [];
  let run = [];

  const flush = () => {
    if (run.length > 1) passes.push(...passesInRun(run));
    run = [];
  };

  for (let i = 0; i < playTrack.length; i += 1) {
    const row = playTrack[i];
    if (!isOpenPlay(row) || (run.length && run[run.length - 1].team !== row.team)) {
      flush();
      if (!isOpenPlay(row)) continue;
    }
    run.push({ i, team: row.team, x: row.x, y: row.y });
  }
  flush();
  return passes;
}

export function passFrom(passes, index) {
  if (!passes?.length) return null;
  for (let i = 0; i < passes.length; i += 1) {
    const pass = passes[i];
    if (index >= pass.start && index < pass.end) return pass;
  }
  return null;
}
