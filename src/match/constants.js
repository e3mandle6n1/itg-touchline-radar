export const EVENT_LABELS = {
  goal: "Goal",
  card: "Card",
  substitution: "Sub",
  corner: "Corner",
  shotontarget: "Shot on target",
  shotofftarget: "Shot off target",
  shotblocked: "Shot blocked",
  goalkeeper_saved: "Goalkeeper save",
  freekick: "Free kick",
  freekick_taken: "Free kick",
  offside: "Offside",
  throwin: "Throw-in",
  goal_kick: "Goal kick",
  injury: "Injured",
  kickoff: "Kick-off",
  periodstart: "Kick-off",
};

export const SITOVER_TYPES = new Set([
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
]);

export const HIGHLIGHT_SITOVER = new Set([
  "goal",
  "card",
  "substitution",
  "injury",
]);

export const PHASE_LABELS = {
  safe: "Ball Safe",
  attack: "Attacking",
  dangerous: "Dangerous Attack",
};

export const BALL_SPEED = 36;
export const PASS_SPEED = 34;
export const MATCH_ANNOUNCE_MS = 2200;

export const EVENT_ICONS = {
  goal: "goal",
  card: "yellow-card",
  substitution: "substitution",
  corner: "corner",
  shotontarget: "shot-on",
  shotofftarget: "shot-off",
  shotblocked: "shot-off",
  goalkeeper_saved: "save",
  freekick: "freekick",
  freekick_taken: "freekick",
  offside: "offside",
  throwin: "throwin",
  goal_kick: "goal-kick",
  injury: "injury",
  match_action: "period",
  periodstart: "period",
  periodscore: "period",
  match_ended: "period",
  kickoff: "period",
};
