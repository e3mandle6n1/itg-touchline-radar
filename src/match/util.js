export function clampPitch(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 50;
  if (n <= 2) return 6;
  if (n >= 98) return 94;
  return Math.max(6, Math.min(94, n));
}

export function family(name) {
  return String(name || "").split(",")[0].trim();
}

export function clockLabel(event) {
  if (!event) return "";
  if (event.clock) return event.clock;
  if (event.minute == null) return "";
  return event.added ? `${event.minute}'+${event.added}` : `${event.minute}'`;
}

export function tipSide(at, team) {
  if (at.x >= 58) return "left";
  if (at.x <= 42) return "right";
  return team === "away" ? "right" : "left";
}

export function cardColour(event) {
  const raw = String(event?.card || "yellow").toLowerCase().replace(/[_/\s]+/g, "");
  if (raw === "red") return "red";
  if (raw === "yellowred" || raw === "secondyellow" || raw === "yellowredcard") return "yellowred";
  return "yellow";
}

export function eventKind(event) {
  return event?.incident || event?.type;
}

export function clockKey(event) {
  return (event?.minute ?? 0) + (event?.added || 0) / 100;
}

export function attackDepth(event) {
  const x = Number(event?.x);
  if (!Number.isFinite(x) || (event?.team !== "home" && event?.team !== "away")) return null;
  return event.team === "away" ? 100 - x : x;
}

export const ATTACK_FROM = 60;
export const DANGER_FROM = 75;

export function possessionPhase(team, x, fromX) {
  const depth = attackDepth({ team, x });
  if (depth == null) return "safe";
  if (fromX != null) {
    const fromDepth = attackDepth({ team, x: fromX });
    if (fromDepth != null && fromDepth - depth >= 4) return "safe";
  }
  if (depth >= DANGER_FROM) return "dangerous";
  if (depth >= ATTACK_FROM) return "attack";
  return "safe";
}
