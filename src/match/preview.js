const MARKS = [15, 30, 45, 60, 75, 90];
const SHAPE = [0.1, 0.14, 0.24, 0.12, 0.16, 0.24];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function clamp(n, lo, hi) {
  return Math.min(hi, Math.max(lo, n));
}

export function kickoffDate(now = new Date()) {
  const kick = new Date(now.getTime());
  kick.setHours(18, 45, 0, 0);
  if (kick.getTime() <= now.getTime()) kick.setDate(kick.getDate() + 1);
  return kick;
}

export function kickoffLabel(now = new Date()) {
  const kick = kickoffDate(now);
  const hh = String(kick.getHours()).padStart(2, "0");
  const mm = String(kick.getMinutes()).padStart(2, "0");
  return `${kick.getDate()} ${MONTHS[kick.getMonth()]} · ${hh}:${mm}`;
}

export function countdownParts(kickoffMs, nowMs) {
  const total = Math.max(0, Math.floor((kickoffMs - nowMs) / 1000));
  return {
    days: Math.floor(total / 86400),
    hrs: Math.floor((total % 86400) / 3600),
    mins: Math.floor((total % 3600) / 60),
    secs: total % 60,
  };
}

export function winChance(homeForm, awayForm, homePos, awayPos) {
  const gap = awayPos - homePos;
  let home = 34 + gap * 0.55 + (homeForm - awayForm) * 0.18;
  let away = 34 - gap * 0.55 + (awayForm - homeForm) * 0.18;
  home = clamp(home, 8, 80);
  away = clamp(away, 8, 80);
  if (home + away > 90) {
    const scale = 90 / (home + away);
    home *= scale;
    away *= scale;
  }
  home = Math.round(home);
  away = Math.round(away);
  return { home, draw: 100 - home - away, away };
}

export function goalsByPeriod(average, tilt = 0) {
  const weights = SHAPE.map((weight, i) => Math.max(0.04, weight + (((tilt + i) % 3) - 1) * 0.02));
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const base = average || 0;
  return MARKS.map((minute, i) => ({
    minute,
    value: Math.round((base * weights[i] / sum) * 100) / 100,
  }));
}
