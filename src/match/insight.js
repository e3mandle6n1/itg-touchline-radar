import { family } from "./util.js";

const KEY = new Set([
  "goal",
  "shotontarget",
  "shotofftarget",
  "shotblocked",
  "goalkeeper_saved",
  "card",
  "tackle",
  "interception",
  "pressure",
  "corner",
  "offside",
  "substitution",
  "periodscore",
  "match_ended",
]);

const WINDOW = 14;

function kindOf(row) {
  return row?.incident || row?.type || "";
}

function teamName(match, team) {
  if (team === "away") return match?.away?.name || "Away";
  if (team === "home") return match?.home?.name || "Home";
  return "";
}

function recentIncidents(playTrack, index) {
  const start = Math.max(0, index - WINDOW);
  const rows = [];
  for (let i = start; i <= index; i += 1) {
    const row = playTrack[i];
    if (!row) continue;
    const kind = kindOf(row);
    if (!kind || kind === "match_action") continue;
    rows.push({ ...row, kind, at: i });
  }
  return rows;
}

function countKinds(rows, kinds, team) {
  const set = new Set(kinds);
  return rows.filter((row) => set.has(row.kind) && (!team || row.team === team)).length;
}

function shotBurst(rows, team) {
  return countKinds(
    rows,
    ["shotontarget", "shotofftarget", "shotblocked", "goalkeeper_saved", "goal"],
    team,
  );
}

function pressureCount(rows, team) {
  return countKinds(rows, ["pressure", "tackle", "interception"], team);
}

function passChainIntoBox(rows, team) {
  const chain = [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (row.team !== team) break;
    if (row.kind === "pass" || row.kind === "possession" || row.kind === "pressure") {
      chain.push(row);
      continue;
    }
    break;
  }
  return chain.length;
}

function deriveState(rows, event) {
  const team = event?.team;
  if (!team) return "transition";
  const shots = shotBurst(rows, team);
  const presses = pressureCount(rows, team);
  const oppShots = shotBurst(rows, team === "home" ? "away" : "home");
  const depth = Number(event?.x);
  const attacking = team === "home" ? depth >= 60 : depth <= 40;

  if (shots >= 3 || (shots >= 2 && presses >= 2)) return "siege";
  if (presses >= 3 && attacking) return "chaos";
  if (oppShots >= 2 && shots === 0) return "transition";
  if (countKinds(rows, ["pass", "possession"], team) >= 4 && shots <= 1) return "control";
  if (attacking && (shots >= 1 || presses >= 1)) return "chaos";
  return "control";
}

function metricFlash(event) {
  const kind = kindOf(event);
  if (kind === "pass") {
    const distance = Number(event.distance);
    const speed = Number(event.speed);
    const hard = event.difficulty === "hard" || distance >= 28;
    if (hard && Number.isFinite(distance)) {
      return {
        label: `${Math.round(distance)}m · ${event.difficulty || "hard"}`,
        detail: `Pass quality · ${event.difficulty || "hard"} · ${Math.round(distance)}m`,
      };
    }
    if (Number.isFinite(speed) && speed >= 65) {
      return {
        label: `${Math.round(speed)} km/h`,
        detail: `Ball speed · ${Math.round(speed)} km/h`,
      };
    }
  }
  if ((kind === "shotontarget" || kind === "shotofftarget" || kind === "goal") && Number(event.speed) >= 70) {
    return {
      label: `${Math.round(Number(event.speed))} km/h shot`,
      detail: `Shot speed · ${Math.round(Number(event.speed))} km/h`,
    };
  }
  return null;
}

function importanceFor(kind, state, rows, event) {
  if (kind === "goal" || kind === "periodscore" || kind === "match_ended") return "high";
  if (kind === "card" || kind === "goalkeeper_saved") return "high";
  if (kind === "shotontarget" || kind === "shotblocked") return state === "siege" ? "high" : "medium";
  if (kind === "shotofftarget" || kind === "corner") return "medium";
  if (kind === "tackle" || kind === "interception") {
    return state === "chaos" || state === "siege" ? "medium" : "low";
  }
  if (kind === "pressure" && state === "siege") return "medium";
  if (kind === "pass" && (event.difficulty === "hard" || Number(event.distance) >= 28)) return "medium";
  if (kind === "substitution" || kind === "offside") return "low";
  if (KEY.has(kind)) return "low";
  return null;
}

function explainGoal(match, event, rows, state) {
  const team = teamName(match, event.team);
  const scorer = family(event.player) || "They";
  const shots = shotBurst(rows, event.team);
  const chain = passChainIntoBox(rows, event.team);
  const presses = pressureCount(rows, event.team);

  let casual;
  let analyst;
  let why;

  if (state === "siege" || shots >= 3) {
    casual = `${scorer} finally breaks the door down — ${team} had been camped in.`;
    analyst = `${scorer} converts after a ${shots}-attempt spell. xThreat cluster resolves.`;
    why = `${team} turned sustained pressure into the scoreline — this is the payoff, not a smash-and-grab.`;
  } else if (chain >= 3) {
    casual = `Worked move. ${scorer} finishes the pattern for ${team}.`;
    analyst = `${scorer} finishes a ${chain}-action progression into the box.`;
    why = `The goal is the end of a constructed sequence — possession with purpose, not a scramble.`;
  } else if (presses >= 2) {
    casual = `Won it high, punished them. ${scorer} for ${team}.`;
    analyst = `${scorer} scores off a high-regain sequence (${presses} pressures/duels in the window).`;
    why = `Territory flip after aggressive pressing — chaos created the chance, ${scorer} took it.`;
  } else {
    casual = `${scorer} changes everything. ${team} lead the story now.`;
    analyst = `${scorer} goal shifts match state. Prior window was ${state}.`;
    why = `Scoreboard moment: the match narrative pivots here regardless of the build.`;
  }

  return { casual, analyst, why };
}

function explainShot(match, event, rows, state, kind) {
  const team = teamName(match, event.team);
  const player = family(event.player) || team;
  const shots = shotBurst(rows, event.team);

  if (kind === "shotontarget" || kind === "goalkeeper_saved") {
    return {
      casual: shots >= 2
        ? `${player} again — ${team} are forcing the issue.`
        : `${player} tests the keeper. Warning shot from ${team}.`,
      analyst: `${player} on target · ${shots} attempts in the live window · state ${state}.`,
      why: shots >= 2
        ? `Repeated attempts signal a siege forming — the next one may not be saved.`
        : `First real ask of the keeper; territory is tipping toward ${team}.`,
    };
  }
  if (kind === "shotblocked") {
    return {
      casual: `Thrown body. ${team}'s sight of goal gets snuffed out.`,
      analyst: `Block denies ${player}. Defensive density holding under ${state}.`,
      why: `A block keeps the score intact — but it also confirms ${team} are getting shots away.`,
    };
  }
  return {
    casual: `${player} leans back — ${team} miss the moment.`,
    analyst: `${player} off target · window attempts ${shots} · ${state}.`,
    why: shots >= 2
      ? `Waste in a good spell — control without the cut.`
      : `Half-chance gone; rhythm stays unsettled.`,
  };
}

function explainCard(match, event, state) {
  const team = teamName(match, event.team);
  const player = family(event.player) || "A player";
  const colour = String(event.card || "yellow").toLowerCase();
  if (colour.includes("red")) {
    return {
      casual: `Gone. ${player} leaves ${team} a man light — the shape has to change.`,
      analyst: `Dismissal · ${player} · ${team}. Expected PPDA/space concession uptick.`,
      why: `Numerical disadvantage rewrites both pressing triggers and rest-defence. Everything after this is a different match.`,
    };
  }
  return {
    casual: `${player} walks a tightrope now. ${team} have to calm the duel.`,
    analyst: `Booking · ${player}. Next foul risk elevates; state was ${state}.`,
    why: `Discipline check — one more mistake and the tactical plan collapses into damage control.`,
  };
}

function explainDuel(match, event, kind, state) {
  const team = teamName(match, event.team);
  const player = family(event.player) || team;
  if (kind === "tackle" || kind === "interception") {
    return {
      casual: `${player} steals it for ${team} — sudden turn of the screw.`,
      analyst: `${kind} won by ${player}. Regain under ${state}.`,
      why: state === "chaos" || state === "siege"
        ? `A clean regain in a volatile spell often precedes the chance. Watch the next 20 seconds.`
        : `Possession flip without a foul — ${team} can build instead of boot.`,
    };
  }
  return {
    casual: `${team} squeeze. ${player} leads the hunt.`,
    analyst: `Pressure event · ${player} · ${state}.`,
    why: `Coordinated pressure is how control becomes chaos — or how a siege starts.`,
  };
}

function explainCorner(match, event, rows) {
  const team = teamName(match, event.team);
  const corners = countKinds(rows, ["corner"], event.team);
  return {
    casual: corners >= 2
      ? `Another corner — ${team} won't go away.`
      : `Corner. ${team} load the box.`,
    analyst: `Set piece · ${team} · ${corners} corners in window.`,
    why: `Dead-ball territory is where thin leads die and comebacks begin.`,
  };
}

function explainPeriod(match, event, kind) {
  const home = match?.home?.name || "Home";
  const away = match?.away?.name || "Away";
  const score = event?.score || match?.score || {};
  if (kind === "match_ended") {
    return {
      casual: `Full time. ${home} ${score.home ?? ""}-${score.away ?? ""} ${away}.`,
      analyst: `FT · final state locked. Recap from momentum swings + key recoveries.`,
      why: `The story is complete — now it's about which spells actually decided it.`,
    };
  }
  return {
    casual: `Break. Time to breathe — and rewrite the plan.`,
    analyst: `Period boundary · HT ${score.ht || `${score.home}:${score.away}`}.`,
    why: `Half-time is where coaches answer the question the first 45 asked.`,
  };
}

function explainPass(match, event, state) {
  const team = teamName(match, event.team);
  const player = family(event.player) || team;
  const distance = Number(event.distance);
  if (event.difficulty === "hard" || distance >= 28) {
    return {
      casual: `${player} opens the pitch for ${team}.`,
      analyst: `Progressive pass · ${player} · ${Math.round(distance) || "?"}m · ${event.difficulty || "hard"}.`,
      why: `A hard switch or line-break pass is often the first frame of a chance — not filler.`,
    };
  }
  if (state === "control") {
    return {
      casual: `${team} keep the ball moving.`,
      analyst: `Circulation · ${player} · ${state}.`,
      why: null,
    };
  }
  return {
    casual: event.text || `${player} on the ball.`,
    analyst: event.text || `Pass · ${player}`,
    why: null,
  };
}

/**
 * Interpret recent play and explain why the current moment matters.
 * @returns {null | {
 *   kind: string,
 *   state: string,
 *   importance: string,
 *   casual: string,
 *   analyst: string,
 *   why: string | null,
 *   metric: { label: string, detail: string } | null,
 * }}
 */
export function explainMoment(playTrack, index, match, options = {}) {
  const event = playTrack?.[index];
  if (!event) return null;

  const kind = kindOf(event);
  if (!kind || kind === "match_action") {
    // Still allow metric-less phase chatter to fall through as null
    return null;
  }

  // Prefer server-authored insight when present.
  if (event.why || event.casual || event.analyst || event.insight) {
    const importance = event.importance || (event.why ? "high" : "medium");
    return {
      kind,
      state: event.state || "control",
      importance,
      casual: event.casual || event.text || "",
      analyst: event.analyst || event.insight || event.text || "",
      why: event.why || event.insight || null,
      metric: event.metricLabel
        ? { label: event.metricLabel, detail: event.metricDetail || event.metricLabel }
        : metricFlash(event),
    };
  }

  if (!KEY.has(kind) && kind !== "pass" && kind !== "possession") return null;

  const rows = recentIncidents(playTrack, index);
  const state = event.state || deriveState(rows, event);
  const metric = metricFlash(event);
  let copy = { casual: event.text || "", analyst: event.text || "", why: null };

  if (kind === "goal") copy = explainGoal(match, event, rows, state);
  else if (kind === "shotontarget" || kind === "shotofftarget" || kind === "shotblocked" || kind === "goalkeeper_saved") {
    copy = explainShot(match, event, rows, state, kind);
  } else if (kind === "card") copy = explainCard(match, event, state);
  else if (kind === "tackle" || kind === "interception" || kind === "pressure") {
    copy = explainDuel(match, event, kind, state);
  } else if (kind === "corner") copy = explainCorner(match, event, rows);
  else if (kind === "periodscore" || kind === "match_ended") copy = explainPeriod(match, event, kind);
  else if (kind === "pass") copy = explainPass(match, event, state);
  else if (kind === "substitution") {
    copy = {
      casual: event.text || "Fresh legs.",
      analyst: event.text || "Substitution · tactical reset.",
      why: `Personnel change is a bet on the next spell — energy, matchup, or damage control.`,
    };
  } else if (kind === "offside") {
    copy = {
      casual: event.text || "Flag up.",
      analyst: event.text || "Offside · attacking line depth check.",
      why: `The line is holding — or the runner mistimed a real chance.`,
    };
  } else if (kind === "possession") {
    copy = {
      casual: event.text || `${teamName(match, event.team)} settle.`,
      analyst: event.text || `Possession · ${state}`,
      why: null,
    };
  }

  const importance = importanceFor(kind, state, rows, event);
  if (!importance && !metric) return null;

  // Favorite-player bump
  const fav = options.favoritePlayer;
  if (fav && event.player && String(event.player).toLowerCase().includes(String(fav).toLowerCase())) {
    return {
      kind,
      state,
      importance: importance === "low" ? "medium" : "high",
      casual: copy.casual,
      analyst: copy.analyst,
      why: copy.why || `${family(event.player)} is on the ball in a ${state} spell — your focus player.`,
      metric,
    };
  }

  return {
    kind,
    state,
    importance: importance || "low",
    casual: copy.casual,
    analyst: copy.analyst,
    why: copy.why,
    metric,
  };
}

export function insightHeadline(insight, tone = "casual") {
  if (!insight) return "";
  return tone === "analyst" ? (insight.analyst || insight.casual) : (insight.casual || insight.analyst);
}

export const MATCH_STATE_LABELS = {
  control: "Control",
  chaos: "Chaos",
  siege: "Siege",
  transition: "Transition",
};
