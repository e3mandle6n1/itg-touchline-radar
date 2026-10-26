/** Hardcoded receipt cards — deterministic numbers, “model” words. Swap for Foundry later. */

export const RECEIPTS = {
  siege: {
    id: "siege",
    question: "Was Northbridge’s second-half siege real, or just the scoreline?",
    status: "live",
    grounded: 4,
    model: "rules + live tally",
    latency: "instant",
    narrative:
      "After the break Northbridge parked the match in Rivermark’s third. Danger-share ran ~84–16 by FT, and the 64'–71' spell turned pressure into a three-goal lead — not a smash-and-grab.",
    figures: [
      { value: "84%", label: "NB danger share", evidence: "sit.danger.share.ft" },
      { value: "9–0", label: "Shots on target", evidence: "evt.sot.split.ft" },
      { value: "3", label: "Goals 64–71'", evidence: "evt.goal.cluster.2h" },
    ],
    chart: {
      title: "Danger ticks by side (live window → FT)",
      bars: [
        { name: "Northbridge", a: 84, b: 16, aLabel: "Danger", bLabel: "Rest" },
        { name: "Rivermark", a: 16, b: 84, aLabel: "Danger", bLabel: "Rest" },
      ],
    },
    caveats: [
      "Danger share is derived from pitch-phase ticks, not Opta xT.",
      "Shot tallies follow the live playhead until FT.",
    ],
  },
  dekker: {
    id: "dekker",
    question: "Why did Dekker’s 64' goal matter more than the assist?",
    status: "live",
    grounded: 3,
    model: "rules + live tally",
    latency: "instant",
    narrative:
      "Dekker’s finish is the payoff after a high-regain press spell. The scoreline flips, Rivermark’s shape breaks, and the next six minutes become a siege — assist sets it up; the goal rewrites the state.",
    figures: [
      { value: "64'", label: "Goal clock", evidence: "evt.goal.dekker.64" },
      { value: "1–0", label: "Score after", evidence: "score.state.64" },
      { value: "chaos", label: "Pre-goal state", evidence: "insight.state.pre64" },
    ],
    chart: {
      title: "Score path",
      bars: [
        { name: "0–63'", a: 0, b: 0, aLabel: "NB", bLabel: "RV" },
        { name: "64'", a: 1, b: 0, aLabel: "NB", bLabel: "RV" },
        { name: "71'", a: 3, b: 0, aLabel: "NB", bLabel: "RV" },
      ],
    },
    caveats: [
      "State labels come from a deterministic window, not a trained model.",
    ],
  },
  passes: {
    id: "passes",
    question: "Show progressive passes that unlocked the box.",
    status: "live",
    grounded: 3,
    model: "rules + live tally",
    latency: "instant",
    narrative:
      "Hard / long completes into the final third light up before each Northbridge goal. Those switches are the first frame of the chance — not filler circulation.",
    figures: [
      { value: "135", label: "Pass events", evidence: "evt.pass.count" },
      { value: "hard", label: "Box unlocks", evidence: "evt.pass.diff.hard" },
      { value: "3", label: "Goal builds", evidence: "seq.pregoal.pass" },
    ],
    chart: {
      title: "Pass difficulty mix (authored feed)",
      bars: [
        { name: "Easy", a: 62, b: 0, aLabel: "Share", bLabel: "" },
        { name: "Medium", a: 28, b: 0, aLabel: "Share", bLabel: "" },
        { name: "Hard", a: 10, b: 0, aLabel: "Share", bLabel: "" },
      ],
    },
    caveats: [
      "Difficulty is synthetic metadata on the enricher feed.",
      "Chart shares are illustrative until Foundry re-scores live.",
    ],
  },
  response: {
    id: "response",
    question: "Did Rivermark ever punch back after 2–0?",
    status: "live",
    grounded: 4,
    model: "rules + live tally",
    latency: "instant",
    narrative:
      "Barely. Away on-target shots finish 0; blocked attempts and a late flurry never tilt danger share. Northbridge’s keepers barely work — Rivermark’s do.",
    figures: [
      { value: "0", label: "RV shots on target", evidence: "evt.sot.away.ft" },
      { value: "2", label: "RV shots blocked", evidence: "evt.blk.away.ft" },
      { value: "16%", label: "RV danger share", evidence: "sit.danger.away.ft" },
    ],
    chart: {
      title: "Shot outcomes",
      bars: [
        { name: "On target", a: 9, b: 0, aLabel: "NB", bLabel: "RV" },
        { name: "Off target", a: 3, b: 1, aLabel: "NB", bLabel: "RV" },
        { name: "Blocked", a: 5, b: 2, aLabel: "NB", bLabel: "RV" },
      ],
    },
    caveats: [
      "Saves attributed to the keeping side when keeper_saved events fire.",
    ],
  },
  cards: {
    id: "cards",
    question: "Which bookings changed the duel tone?",
    status: "live",
    grounded: 2,
    model: "rules + live tally",
    latency: "instant",
    narrative:
      "Three yellows (2–1) — Navarro early, Okello late, Weber in stoppage. None are dismissals, but they mark where the duel stops being casual and starts being managed.",
    figures: [
      { value: "2–1", label: "Yellows", evidence: "evt.card.yellow.split" },
      { value: "0", label: "Reds", evidence: "evt.card.red.split" },
      { value: "29'", label: "First booking", evidence: "evt.card.first" },
    ],
    chart: null,
    caveats: [
      "Card colour parsed from event.card; second-yellow not present in this feed.",
    ],
  },
  recap: {
    id: "recap",
    question: "Give me a 20-second fan recap of Harbor View.",
    status: "live",
    grounded: 3,
    model: "rules + live tally",
    latency: "instant",
    narrative:
      "Northbridge host Rivermark, wait until the hour, then detonate: Dekker, Okonkwo, Okoro. Three goals, zero reply, Harbor View loud — Continental Cup night done by 71'.",
    figures: [
      { value: "3–0", label: "FT", evidence: "score.ft" },
      { value: "0–0", label: "HT", evidence: "score.ht" },
      { value: "71'", label: "Match decided", evidence: "evt.goal.third" },
    ],
    chart: null,
    caveats: [
      "Fan copy is templated; Foundry can voice this later per market/language.",
    ],
  },
};

export function receiptFor(id) {
  return RECEIPTS[id] || RECEIPTS.siege;
}
