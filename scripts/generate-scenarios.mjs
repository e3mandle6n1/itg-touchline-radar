#!/usr/bin/env node
/**
 * Builds feeds/matches/*.json scenario feeds (lean events), then enrich separately.
 */
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "feeds", "matches");
mkdirSync(outDir, { recursive: true });

const base = JSON.parse(readFileSync(join(root, "feeds", "match.json"), "utf8"));

const STATS = base.stats;
const STANDINGS = (base.standings || []).slice(0, 12);
const MARKS = ["0", "15", "30", "45+1", "60", "75", "90+4"];

function clockOf(minute, added = 0) {
  return added ? `${minute}'+${added}` : `${minute}'`;
}

function ev({ type, team, minute, added = 0, clock, score, ...rest }) {
  return {
    type,
    team,
    minute,
    added,
    clock: clock ?? (minute == null ? undefined : clockOf(minute, added)),
    score: score || { home: 0, away: 0 },
    ...rest,
  };
}

function shell({ id, competition, home, away, score, info, lineups, events, momentum }) {
  return {
    id,
    competition,
    status: "Ended",
    home: {
      crest: "/icons/jersey-home.svg",
      color: home.color || "#e10000",
      ...home,
    },
    away: {
      crest: "/icons/jersey-away.svg",
      color: away.color || "#1a2c7e",
      ...away,
    },
    averages: { goalsPerMatch: { home: 1.5, away: 1.2 } },
    score,
    info: {
      weather: "Good",
      pitch: "Good",
      distance: "180 km",
      capacity: "42,000",
      ...info,
    },
    marks: MARKS,
    momentum: momentum || [],
    stats: STATS,
    form: base.form,
    standings: STANDINGS,
    lineups,
    events,
    situations: [],
  };
}

function renameXi(xi, names) {
  return xi.map((p, i) => ({ ...p, name: names[i] || p.name, id: 1000 + i }));
}

const nbHome = base.lineups.home;
const nbAway = base.lineups.away;

const saHomeNames = [
  "Williams, Ronwen", "Mudau, Khuliso", "Kekana, Hlompho", "Mokoena, Teboho",
  "Modiba, Aubrey", "Zwane, Themba", "Modise, Teko", "Tau, Percy",
  "Dolly, Keagan", "Erasmus, Kermit", "Mkhulise, Sphelele",
];
const saAwayNames = [
  "Keet, Darren", "Mphahlele, Ramahlwe", "Cardoso, Ricardo", "Jali, Andile",
  "Maela, Innocentia", "Makgopa, Evidence", "Mabasa, Nyiko", "Shalulile, Peter",
  "Mabizela, Mbulelo", "Lakay, Lyle", "Mayambela, Mihlali",
];

const saHome = {
  formation: "4-3-3",
  manager: "Ntseki, Molefi",
  xi: renameXi(nbHome.xi, saHomeNames),
  subs: [
    { number: "16", name: "Goss, Bruce", pos: "G", role: "GOALKEEPER" },
    { number: "2", name: "Moon, Calvin", pos: "D", role: "DEFENDER" },
    { number: "11", name: "Sirino, Gaston", pos: "M", role: "MIDFIELDER" },
    { number: "9", name: "Ribeiro, Ricardo", pos: "F", role: "FORWARD" },
    { number: "21", name: "Mvala, Mothobi", pos: "M", role: "MIDFIELDER" },
  ],
  swaps: [],
};
const saAway = {
  formation: "4-2-3-1",
  manager: "Komphela, Steve",
  xi: renameXi(nbAway.xi, saAwayNames),
  subs: [
    { number: "30", name: "Mpahlele, Sifiso", pos: "G", role: "GOALKEEPER" },
    { number: "5", name: "Nyauza, Ntsikelelo", pos: "D", role: "DEFENDER" },
    { number: "8", name: "Motshwari, Ben", pos: "M", role: "MIDFIELDER" },
    { number: "17", name: "Mahlambi, Phakamani", pos: "F", role: "FORWARD" },
    { number: "23", name: "Kekana, Grant", pos: "D", role: "DEFENDER" },
  ],
  swaps: [],
};

function openPlaySkeleton(h, a, extras = []) {
  return [
    ev({ type: "periodstart", clock: "1st half", minute: 0, text: "The referee blows to start the match." }),
    ev({ type: "throwin", team: "home", minute: 3, x: 30, y: 20, text: `Throw-in for ${h}.` }),
    ev({ type: "freekick", team: "away", minute: 12, x: 40, y: 50, text: `Free kick for ${a}.` }),
    ev({ type: "corner", team: "home", minute: 28, x: 95, y: 8, text: `Corner awarded to ${h}.` }),
    ...extras.filter((e) => (e.minute ?? 0) < 45),
    ev({ type: "periodscore", clock: "1st half", minute: 45, text: "The first half comes to a close." }),
    ev({ type: "periodstart", clock: "2nd half", minute: 45, text: "The second half gets underway." }),
    ...extras.filter((e) => (e.minute ?? 0) >= 45),
  ];
}

function finish90(score, extras = []) {
  return [
    ...extras,
    ev({ type: "periodscore", clock: "Full Time", minute: 90, added: 4, score, text: `The score after normal time is ${score.home} - ${score.away}.` }),
    ev({ type: "match_ended", clock: "Match end", minute: 90, added: 4, score, text: `Full time. Final score ${score.home} - ${score.away}.` }),
  ];
}

// --- scenarios ---

const scenarios = [];

// 01 default copy
copyFileSync(join(root, "feeds", "match.json"), join(outDir, "01-northbridge.json"));
scenarios.push({
  id: "01-northbridge",
  title: "Northbridge 3-0 Rivermark",
  file: "01-northbridge.json",
  tags: ["default", "open-play"],
});

// 02 pens with 1 miss (SA names)
{
  const h = "Soweto United";
  const a = "Cape Royals";
  const score90 = { home: 1, away: 1 };
  const events = [
    ...openPlaySkeleton(h, a, [
      ev({ type: "goal", team: "home", minute: 34, x: 88, y: 48, player: "Tau, Percy", text: `Goal! Percy Tau puts ${h} ahead.`, score: { home: 1, away: 0 } }),
      ev({ type: "goal", team: "away", minute: 71, x: 12, y: 52, player: "Shalulile, Peter", text: `Goal! Peter Shalulile levels for ${a}.`, score: score90 }),
    ]),
    ...finish90(score90).slice(0, 1), // FT periodscore only, then pens before match_ended
    ev({ type: "periodstart", clock: "Penalties", minute: 90, added: 5, score: score90, text: "We go to a penalty shoot-out." }),
    ev({ type: "goal", team: "home", minute: 90, added: 6, x: 88, y: 50, player: "Zwane, Themba", shootout: true, period: "penalties", text: "Zwane scores from the spot.", score: score90 }),
    ev({ type: "goal", team: "away", minute: 90, added: 7, x: 12, y: 50, player: "Lakay, Lyle", shootout: true, period: "penalties", text: "Lakay converts.", score: score90 }),
    ev({ type: "shotofftarget", team: "home", minute: 90, added: 8, x: 88, y: 44, player: "Erasmus, Kermit", shootout: true, period: "penalties", text: "Erasmus misses! Over the bar.", score: score90 }),
    ev({ type: "goal", team: "away", minute: 90, added: 9, x: 12, y: 50, player: "Jali, Andile", shootout: true, period: "penalties", text: "Jali scores. Cape Royals lead the shoot-out.", score: score90 }),
    ev({ type: "goal", team: "home", minute: 90, added: 10, x: 88, y: 50, player: "Mokoena, Teboho", shootout: true, period: "penalties", text: "Mokoena scores.", score: score90 }),
    ev({ type: "goal", team: "away", minute: 90, added: 11, x: 12, y: 50, player: "Mayambela, Mihlali", shootout: true, period: "penalties", text: "Mayambela seals it from the spot.", score: score90 }),
    ev({ type: "match_ended", clock: "Match end", minute: 90, added: 12, score: score90, text: "Cape Royals win the shoot-out." }),
  ];
  writeFileSync(join(outDir, "02-pens-miss.json"), `${JSON.stringify(shell({
    id: 9002,
    competition: "SA Cup",
    home: { name: h, short: "SOW", color: "#ffcd00" },
    away: { name: a, short: "CPR", color: "#003399" },
    score: { ...score90, ht: "1 : 0", pens: "2-4" },
    info: { referee: "Gumede, Victor", managers: [saHome.manager, saAway.manager], venue: "FNB Arena", city: "Johannesburg" },
    lineups: { home: saHome, away: saAway },
    events,
    momentum: [
      { minute: 34, type: "goal", team: "home" },
      { minute: 71, type: "goal", team: "away" },
    ],
  }))}\n`);
  scenarios.push({ id: "02-pens-miss", title: "Soweto United vs Cape Royals (pens, 1 miss)", file: "02-pens-miss.json", tags: ["pens", "sa"] });
}

// 03 second yellow after injury + forced sub
{
  const h = "Northbridge";
  const a = "Rivermark";
  const villain = "Okello, Juma";
  const victim = "Lindqvist, Nils";
  const score = { home: 1, away: 0 };
  const events = [
    ...openPlaySkeleton(h, a, [
      ev({ type: "card", team: "away", minute: 22, x: 55, y: 40, player: villain, card: "yellow", text: `${villain.split(", ")[1]} is booked.` }),
      ev({ type: "injury", team: "home", minute: 58, x: 62, y: 48, player: victim, text: `Play stops. ${victim.split(", ")[1]} is down after a heavy challenge.` }),
      ev({ type: "card", team: "away", minute: 59, x: 62, y: 48, player: villain, card: "yellowred", text: `Second yellow! ${villain.split(", ")[1]} is sent off.` }),
      ev({ type: "substitution", team: "home", minute: 60, player: `${victim} / Okoro, Tayo`, text: `Forced change: Okoro replaces the injured Lindqvist.` }),
      ev({ type: "goal", team: "home", minute: 77, x: 90, y: 50, player: "Okoro, Tayo", text: `Okoro makes it 1-0.`, score }),
    ]),
    ...finish90(score),
  ];
  writeFileSync(join(outDir, "03-second-yellow-injury.json"), `${JSON.stringify(shell({
    id: 9003,
    competition: "Continental Cup",
    home: { name: h, short: "NB" },
    away: { name: a, short: "RV" },
    score: { ...score, ht: "0 : 0" },
    info: base.info,
    lineups: base.lineups,
    events,
    momentum: [
      { minute: 22, type: "card", team: "away", card: "yellow" },
      { minute: 59, type: "card", team: "away", card: "red" },
      { minute: 60, type: "substitution", team: "home" },
      { minute: 77, type: "goal", team: "home" },
    ],
  }))}\n`);
  scenarios.push({ id: "03-second-yellow-injury", title: "Second yellow after injury (forced sub)", file: "03-second-yellow-injury.json", tags: ["cards", "injury"] });
}

// 04 ET then pens, 2 misses, sudden death
{
  const h = "Highveld FC";
  const a = "Garden Route";
  const s0 = { home: 0, away: 0 };
  const events = [
    ...openPlaySkeleton(h, a, [
      ev({ type: "shotontarget", team: "home", minute: 40, x: 82, y: 50, text: "Saved." }),
      ev({ type: "shotofftarget", team: "away", minute: 68, x: 18, y: 40, text: "Wide." }),
    ]),
    ev({ type: "periodscore", clock: "Full Time", minute: 90, added: 3, score: s0, text: "Still 0-0 after 90. Extra time." }),
    ev({ type: "periodstart", clock: "Extra time · 1st half", minute: 90, added: 4, score: s0, text: "Extra time begins." }),
    ev({ type: "corner", team: "home", minute: 97, x: 96, y: 10, text: `Corner for ${h}.` }),
    ev({ type: "periodscore", clock: "Extra time", minute: 105, score: s0, text: "End of the first period of extra time." }),
    ev({ type: "periodstart", clock: "Extra time · 2nd half", minute: 105, added: 1, score: s0, text: "Second period of extra time." }),
    ev({ type: "shotblocked", team: "away", minute: 112, x: 22, y: 55, text: "Blocked on the line." }),
    ev({ type: "periodscore", clock: "Extra Time", minute: 120, score: s0, text: "No winner in extra time. Penalties." }),
    ev({ type: "periodstart", clock: "Penalties", minute: 120, added: 1, score: s0, text: "Penalty shoot-out to decide it." }),
    // 1-1, miss, miss, then sudden death
    ev({ type: "goal", team: "home", minute: 120, added: 2, x: 88, y: 50, player: "Zwane, Themba", shootout: true, period: "penalties", text: "Scored.", score: s0 }),
    ev({ type: "goal", team: "away", minute: 120, added: 3, x: 12, y: 50, player: "Shalulile, Peter", shootout: true, period: "penalties", text: "Scored.", score: s0 }),
    ev({ type: "shotofftarget", team: "home", minute: 120, added: 4, x: 88, y: 42, player: "Tau, Percy", shootout: true, period: "penalties", text: "Miss! Saved by the post.", score: s0 }),
    ev({ type: "shotofftarget", team: "away", minute: 120, added: 5, x: 12, y: 58, player: "Lakay, Lyle", shootout: true, period: "penalties", text: "Miss! Blazed over.", score: s0 }),
    ev({ type: "goal", team: "home", minute: 120, added: 6, x: 88, y: 50, player: "Mokoena, Teboho", shootout: true, period: "penalties", text: "Scored.", score: s0 }),
    ev({ type: "goal", team: "away", minute: 120, added: 7, x: 12, y: 50, player: "Jali, Andile", shootout: true, period: "penalties", text: "Scored.", score: s0 }),
    ev({ type: "goal", team: "home", minute: 120, added: 8, x: 88, y: 50, player: "Kekana, Hlompho", shootout: true, period: "penalties", text: "Scored.", score: s0 }),
    ev({ type: "goal", team: "away", minute: 120, added: 9, x: 12, y: 50, player: "Maela, Innocentia", shootout: true, period: "penalties", text: "Scored. Sudden death.", score: s0 }),
    ev({ type: "goal", team: "home", minute: 120, added: 10, x: 88, y: 50, player: "Dolly, Keagan", shootout: true, period: "penalties", text: "Sudden death — scored.", score: s0 }),
    ev({ type: "shotofftarget", team: "away", minute: 120, added: 11, x: 12, y: 45, player: "Mayambela, Mihlali", shootout: true, period: "penalties", text: "Sudden death miss! Highveld win it.", score: s0 }),
    ev({ type: "match_ended", clock: "Match end", minute: 120, added: 12, score: s0, text: "Highveld FC win on penalties after sudden death." }),
  ];
  writeFileSync(join(outDir, "04-et-pens-sudden-death.json"), `${JSON.stringify(shell({
    id: 9004,
    competition: "SA Cup",
    home: { name: h, short: "HVF", color: "#ff6600" },
    away: { name: a, short: "GRT", color: "#006633" },
    score: { ...s0, ht: "0 : 0", pens: "5-4" },
    info: { referee: "Molefe, Thando", managers: [saHome.manager, saAway.manager], venue: "Loftus Field", city: "Pretoria" },
    lineups: { home: { ...saHome, manager: "Mosimane, Pitso" }, away: saAway },
    events,
  }))}\n`);
  scenarios.push({ id: "04-et-pens-sudden-death", title: "ET then pens (2 misses, sudden death)", file: "04-et-pens-sudden-death.json", tags: ["et", "pens", "sa"] });
}

// 05 injury + pens (1 miss)
{
  const h = "Northbridge";
  const a = "Rivermark";
  const score = { home: 2, away: 2 };
  const events = [
    ...openPlaySkeleton(h, a, [
      ev({ type: "goal", team: "home", minute: 18, x: 88, y: 48, player: "Hayes, Owen", text: "Hayes opens the scoring.", score: { home: 1, away: 0 } }),
      ev({ type: "goal", team: "away", minute: 41, x: 14, y: 50, player: "Sato, Ren", text: "Sato equalises.", score: { home: 1, away: 1 } }),
      ev({ type: "injury", team: "away", minute: 63, x: 40, y: 50, player: "Farouk, Samir", text: "Farouk is hurt and needs treatment." }),
      ev({ type: "substitution", team: "away", minute: 65, player: "Farouk, Samir / Haddad, Karim", text: "Haddad replaces Farouk." }),
      ev({ type: "goal", team: "home", minute: 80, x: 86, y: 44, player: "Okonkwo, Chidi", text: "Okonkwo makes it 2-1.", score: { home: 2, away: 1 } }),
      ev({ type: "goal", team: "away", minute: 88, x: 16, y: 52, player: "Ndiaye, Kofi", text: "Ndiaye levels late.", score }),
    ]),
    ev({ type: "periodscore", clock: "Full Time", minute: 90, added: 5, score, text: "2-2. Penalties." }),
    ev({ type: "periodstart", clock: "Penalties", minute: 90, added: 6, score, text: "Penalty shoot-out." }),
    ev({ type: "goal", team: "home", minute: 90, added: 7, x: 88, y: 50, shootout: true, period: "penalties", player: "Okoro, Tayo", text: "Scored.", score }),
    ev({ type: "shotofftarget", team: "away", minute: 90, added: 8, x: 12, y: 40, shootout: true, period: "penalties", player: "Sato, Ren", text: "Missed!", score }),
    ev({ type: "goal", team: "home", minute: 90, added: 9, x: 88, y: 50, shootout: true, period: "penalties", player: "Hayes, Owen", text: "Scored. Northbridge win it.", score }),
    ev({ type: "match_ended", clock: "Match end", minute: 90, added: 10, score, text: "Northbridge win on penalties." }),
  ];
  writeFileSync(join(outDir, "05-injury-pens.json"), `${JSON.stringify(shell({
    id: 9005,
    competition: "Continental Cup",
    home: { name: h, short: "NB" },
    away: { name: a, short: "RV" },
    score: { ...score, ht: "1 : 1", pens: "2-0" },
    info: base.info,
    lineups: base.lineups,
    events,
  }))}\n`);
  scenarios.push({ id: "05-injury-pens", title: "Injury + pens (1 miss)", file: "05-injury-pens.json", tags: ["injury", "pens"] });
}

// 06 straight red, 10v11
{
  const h = "Northbridge";
  const a = "Rivermark";
  const score = { home: 0, away: 1 };
  const events = [
    ...openPlaySkeleton(h, a, [
      ev({ type: "card", team: "home", minute: 31, x: 48, y: 50, player: "Santos, Paulo", card: "red", text: "Straight red for Santos!" }),
      ev({ type: "goal", team: "away", minute: 55, x: 18, y: 48, player: "Bjornsson, Ari", text: "Bjornsson capitalises with ten men on the pitch.", score }),
    ]),
    ...finish90(score),
  ];
  writeFileSync(join(outDir, "06-straight-red.json"), `${JSON.stringify(shell({
    id: 9006,
    competition: "Continental Cup",
    home: { name: h, short: "NB" },
    away: { name: a, short: "RV" },
    score: { ...score, ht: "0 : 0" },
    info: base.info,
    lineups: base.lineups,
    events,
    momentum: [
      { minute: 31, type: "card", team: "home", card: "red" },
      { minute: 55, type: "goal", team: "away" },
    ],
  }))}\n`);
  scenarios.push({ id: "06-straight-red", title: "Straight red (10 v 11)", file: "06-straight-red.json", tags: ["cards"] });
}

// 07 sparse 0-0
{
  const h = "Northbridge";
  const a = "Rivermark";
  const score = { home: 0, away: 0 };
  const events = [
    ev({ type: "periodstart", clock: "1st half", minute: 0, text: "Kick-off." }),
    ev({ type: "throwin", team: "home", minute: 19, x: 35, y: 15, text: "Throw-in." }),
    ev({ type: "goal_kick", team: "away", minute: 44, x: 8, y: 50, text: "Goal kick." }),
    ev({ type: "periodscore", clock: "1st half", minute: 45, text: "Half-time, still 0-0." }),
    ev({ type: "periodstart", clock: "2nd half", minute: 45, text: "Second half." }),
    ev({ type: "corner", team: "away", minute: 78, x: 4, y: 90, text: "Late corner." }),
    ...finish90(score),
  ];
  writeFileSync(join(outDir, "07-sparse-stalemate.json"), `${JSON.stringify(shell({
    id: 9007,
    competition: "Continental Cup",
    home: { name: h, short: "NB" },
    away: { name: a, short: "RV" },
    score: { ...score, ht: "0 : 0" },
    info: base.info,
    lineups: base.lineups,
    events,
  }))}\n`);
  scenarios.push({ id: "07-sparse-stalemate", title: "Sparse 0-0", file: "07-sparse-stalemate.json", tags: ["sparse"] });
}

// 08 high event open play
{
  const h = "Northbridge";
  const a = "Rivermark";
  const score = { home: 4, away: 2 };
  const burst = [];
  let sh = 0;
  let sa = 0;
  const homeScorers = ["Lindqvist, Nils", "Okoro, Tayo", "Hayes, Owen", "Okonkwo, Chidi"];
  const awayScorers = ["Sato, Ren", "Ndiaye, Kofi"];
  for (let m = 8; m < 90; m += 7) {
    burst.push(ev({ type: "throwin", team: m % 2 ? "home" : "away", minute: m, x: 20 + (m % 60), y: 20 + (m % 40), text: "Throw-in." }));
    if (m % 14 === 0) burst.push(ev({ type: "corner", team: "home", minute: m + 1, x: 96, y: 12, text: "Corner." }));
    if (m % 21 === 0) burst.push(ev({ type: "card", team: "away", minute: m + 2, x: 50, y: 50, player: "Farouk, Samir", card: "yellow", text: "Yellow card." }));
    if ([15, 33, 61, 84].includes(m)) {
      sh += 1;
      burst.push(ev({ type: "goal", team: "home", minute: m, x: 88, y: 48, player: homeScorers[sh - 1], text: `Goal ${sh}- ${sa}.`, score: { home: sh, away: sa } }));
    }
    if ([40, 70].includes(m)) {
      sa += 1;
      burst.push(ev({ type: "goal", team: "away", minute: m, x: 12, y: 50, player: awayScorers[sa - 1], text: `Goal ${sh}-${sa}.`, score: { home: sh, away: sa } }));
    }
  }
  const events = [
    ...openPlaySkeleton(h, a, burst),
    ...finish90(score),
  ];
  writeFileSync(join(outDir, "08-high-event.json"), `${JSON.stringify(shell({
    id: 9008,
    competition: "Continental Cup",
    home: { name: h, short: "NB" },
    away: { name: a, short: "RV" },
    score: { ...score, ht: "2 : 1" },
    info: base.info,
    lineups: base.lineups,
    events,
  }))}\n`);
  scenarios.push({ id: "08-high-event", title: "High-event 4-2", file: "08-high-event.json", tags: ["open-play", "dense"] });
}

// 09 SA derby open play winner
{
  const h = "Soweto United";
  const a = "Cape Royals";
  const score = { home: 2, away: 1 };
  const events = [
    ...openPlaySkeleton(h, a, [
      ev({ type: "goal", team: "away", minute: 11, x: 14, y: 48, player: "Shalulile, Peter", text: "Shalulile strikes early.", score: { home: 0, away: 1 } }),
      ev({ type: "goal", team: "home", minute: 39, x: 86, y: 50, player: "Tau, Percy", text: "Tau equalises.", score: { home: 1, away: 1 } }),
      ev({ type: "card", team: "away", minute: 52, x: 60, y: 40, player: "Jali, Andile", card: "yellow", text: "Jali booked." }),
      ev({ type: "goal", team: "home", minute: 81, x: 90, y: 46, player: "Zwane, Themba", text: "Zwane wins the derby!", score }),
    ]),
    ...finish90(score),
  ];
  writeFileSync(join(outDir, "09-sa-derby.json"), `${JSON.stringify(shell({
    id: 9009,
    competition: "SA Cup",
    home: { name: h, short: "SOW", color: "#ffcd00" },
    away: { name: a, short: "CPR", color: "#003399" },
    score: { ...score, ht: "1 : 1" },
    info: { referee: "Gumede, Victor", managers: [saHome.manager, saAway.manager], venue: "FNB Arena", city: "Johannesburg" },
    lineups: { home: saHome, away: saAway },
    events,
    momentum: [
      { minute: 11, type: "goal", team: "away" },
      { minute: 39, type: "goal", team: "home" },
      { minute: 52, type: "card", team: "away", card: "yellow" },
      { minute: 81, type: "goal", team: "home" },
    ],
  }))}\n`);
  scenarios.push({ id: "09-sa-derby", title: "SA derby (90' winner)", file: "09-sa-derby.json", tags: ["sa", "open-play"] });
}

// 10 SA derby ET winner (no pens)
{
  const h = "Highveld FC";
  const a = "Garden Route";
  const s0 = { home: 1, away: 1 };
  const sEt = { home: 2, away: 1 };
  const events = [
    ...openPlaySkeleton(h, a, [
      ev({ type: "goal", team: "home", minute: 27, x: 88, y: 50, player: "Erasmus, Kermit", text: "Erasmus scores.", score: { home: 1, away: 0 } }),
      ev({ type: "goal", team: "away", minute: 74, x: 12, y: 48, player: "Makgopa, Evidence", text: "Makgopa equalises.", score: s0 }),
    ]),
    ev({ type: "periodscore", clock: "Full Time", minute: 90, added: 2, score: s0, text: "1-1. Extra time." }),
    ev({ type: "periodstart", clock: "Extra time · 1st half", minute: 90, added: 3, score: s0, text: "Extra time." }),
    ev({ type: "shotontarget", team: "away", minute: 99, x: 18, y: 50, text: "Saved." }),
    ev({ type: "periodscore", clock: "Extra time", minute: 105, score: s0, text: "Still level." }),
    ev({ type: "periodstart", clock: "Extra time · 2nd half", minute: 105, added: 1, score: s0, text: "Second period of ET." }),
    ev({ type: "goal", team: "home", minute: 113, x: 86, y: 52, player: "Tau, Percy", text: "Tau wins it in extra time!", score: sEt }),
    ev({ type: "periodscore", clock: "Extra Time", minute: 120, score: sEt, text: "Extra time ends 2-1." }),
    ev({ type: "match_ended", clock: "Match end", minute: 120, added: 1, score: sEt, text: "Highveld FC win in extra time." }),
  ];
  writeFileSync(join(outDir, "10-sa-et-winner.json"), `${JSON.stringify(shell({
    id: 9010,
    competition: "SA Cup",
    home: { name: h, short: "HVF", color: "#ff6600" },
    away: { name: a, short: "GRT", color: "#006633" },
    score: { ...sEt, ht: "1 : 0" },
    info: { referee: "Molefe, Thando", managers: ["Mosimane, Pitso", saAway.manager], venue: "Loftus Field", city: "Pretoria" },
    lineups: { home: { ...saHome, manager: "Mosimane, Pitso" }, away: saAway },
    events,
  }))}\n`);
  scenarios.push({ id: "10-sa-et-winner", title: "SA derby ET winner (no pens)", file: "10-sa-et-winner.json", tags: ["sa", "et"] });
}

writeFileSync(join(outDir, "index.json"), `${JSON.stringify({ defaultId: "01-northbridge", matches: scenarios }, null, 2)}\n`);
console.log(`wrote ${scenarios.length} matches to ${outDir}`);
