#!/usr/bin/env python3
"""Stitch open-play texture into Northbridge so the feed reads like a real match."""

from __future__ import annotations

import json
import math
import random
from copy import deepcopy
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "dist" / "matches" / "01-northbridge.json"
OUT_DIST = SRC
SEED_DIR = Path("/Users/emandleni/Documents/touchline-radar/matches")
OUT_SEED = SEED_DIR / "01-northbridge.json"

rng = random.Random(74165908)

HOME_OUTFIELD = [
    "Dekker, Niels",
    "Dane, Ezra",
    "Costa, Rafael",
    "Quinn, Miles",
    "Santos, Paulo",
    "Hayes, Owen",
    "Adeyemi, Tunde",
    "Navarro, Diego",
    "Okonkwo, Chidi",
    "Lindqvist, Nils",
]
AWAY_OUTFIELD = [
    "Okello, Juma",
    "Mwangi, Joel",
    "Ferreira, Tiago",
    "Lefevre, Anton",
    "Farouk, Samir",
    "Holt, Micah",
    "Ndiaye, Kofi",
    "Banza, Yves",
    "Bjornsson, Ari",
    "Sato, Ren",
]
HOME_LATE = ["Okoro, Tayo", "Weber, Lars", "Kessler, Jonas", "Clarke, Adam", "Pell, Noah"]
AWAY_LATE = ["Holm, Soren", "Haddad, Karim", "Bosch, Erik", "Durand, Remy", "Keita, Amadou"]

PASS_TEXT = [
    "{player} switches play for {club}.",
    "{player} finds a teammate in space.",
    "Patient build from {club} — {player} keeps it.",
    "{player} threads a pass through midfield.",
    "{player} recycles possession for {club}.",
    "Quick combination — {player} on the ball.",
    "{player} opens the pitch with a diagonal.",
]
PRESS_TEXT = [
    "{club} squeeze high — {player} leads the press.",
    "Heavy pressure from {club}. {player} closes down.",
    "{player} hunts the ball in a dangerous area.",
]
TACKLE_TEXT = [
    "{player} wins it cleanly for {club}.",
    "Strong challenge from {player}.",
    "{player} snaps into the tackle.",
]
INTERCEPT_TEXT = [
    "{player} reads the pass and cuts it out.",
    "Interception! {player} steps in for {club}.",
]
POSSESSION_TEXT = [
    "{club} settle and keep the ball.",
    "{player} shields possession for {club}.",
    "{club} work it out of a tight spot.",
]


def club_name(team: str) -> str:
    return "Northbridge FC" if team == "home" else "Rivermark SC"


def pool_for(team: str, minute: int) -> list[str]:
    base = list(HOME_OUTFIELD if team == "home" else AWAY_OUTFIELD)
    if minute >= 65:
        base = base + (HOME_LATE if team == "home" else AWAY_LATE)
    return base


def pick_player(team: str, minute: int, avoid: str | None = None) -> str:
    pool = [p for p in pool_for(team, minute) if p != avoid]
    return rng.choice(pool or pool_for(team, minute))


def clock_of(minute: int, added: int = 0) -> str:
    if added:
        return f"{minute}'+{added}"
    return f"{minute}'"


def clamp(v: float, lo: float = 6.0, hi: float = 94.0) -> float:
    return max(lo, min(hi, v))


def attack_x(team: str, depth: float) -> float:
    depth = clamp(depth, 8, 94)
    return depth if team == "home" else 100 - depth


def dist(a: tuple[float, float], b: tuple[float, float]) -> float:
    return math.hypot(b[0] - a[0], b[1] - a[1])


def difficulty_for(distance: float, toward_goal: bool) -> str:
    if distance >= 28 and toward_goal:
        return "hard"
    if distance >= 18 or toward_goal:
        return "medium"
    return "easy"


def event(
    type_: str,
    team: str,
    minute: int,
    added: int,
    x: float,
    y: float,
    player: str | None,
    text: str,
    score: dict,
    **extra,
) -> dict:
    row = {
        "type": type_,
        "team": team,
        "minute": minute,
        "added": added,
        "clock": clock_of(minute, added),
        "score": deepcopy(score),
        "x": round(clamp(x), 1),
        "y": round(clamp(y), 1),
        "text": text,
    }
    if player:
        row["player"] = player
    row.update(extra)
    return row


def fill_phrase(template: str, team: str, player: str) -> str:
    return template.format(player=player.split(",")[0], club=club_name(team))


def sequence_between(
    prev: dict,
    nxt: dict,
    score: dict,
) -> list[dict]:
    """Author a short open-play beat between two existing incidents."""
    if prev.get("type") in {"periodscore", "match_ended", "substitution", "injury", "backfrominjury", "card"}:
        return []
    if nxt.get("type") in {"periodstart", "periodscore", "match_ended"}:
        return []

    p_min = prev.get("minute")
    n_min = nxt.get("minute")
    if p_min is None or n_min is None:
        return []

    p_key = p_min + (prev.get("added") or 0) / 100.0
    n_key = n_min + (nxt.get("added") or 0) / 100.0
    gap = n_key - p_key
    if gap < 0.6:
        return []

    # Don't flood already busy same-minute clusters.
    if gap < 1.0 and prev.get("type") in {"pass", "pressure", "tackle", "possession"}:
        return []

    team = prev.get("team") or nxt.get("team") or "home"
    if prev.get("type") in {"goal_kick", "throwin", "corner", "freekick", "freekick_taken"}:
        team = prev.get("team") or team
    if nxt.get("type") in {"goal", "shotontarget", "shotofftarget", "shotblocked", "corner"}:
        # Build toward the next chance with the attacking side.
        team = nxt.get("team") or team

    px = float(prev.get("x") if prev.get("x") is not None else (40 if team == "home" else 60))
    py = float(prev.get("y") if prev.get("y") is not None else 50)
    nx = float(nxt.get("x") if nxt.get("x") is not None else attack_x(team, 72))
    ny = float(nxt.get("y") if nxt.get("y") is not None else 50)

    # Chance of possession flip mid-sequence when gap is large.
    flip = gap >= 2.0 and rng.random() < 0.35
    steps = 3 if gap < 1.5 else (4 if gap < 2.5 else 5)
    if nxt.get("type") == "goal":
        steps = max(steps, 5)
        flip = False
        team = nxt.get("team") or team

    out: list[dict] = []
    cur_team = team
    x, y = px, py
    player = pick_player(cur_team, int(p_min))

    for i in range(steps):
        t = (i + 1) / (steps + 1)
        minute = int(p_min + (n_min - p_min) * t)
        # Keep added time if both sit in stoppage.
        added = 0
        if (prev.get("added") or 0) or (nxt.get("added") or 0):
            added = int(round((prev.get("added") or 0) * (1 - t) + (nxt.get("added") or 0) * t))
            minute = p_min if (prev.get("added") or 0) else minute

        if flip and i == steps // 2:
            cur_team = "away" if cur_team == "home" else "home"
            player = pick_player(cur_team, minute, avoid=player)
            kind = rng.choice(["tackle", "interception", "pressure"])
        elif i == steps - 1 and nxt.get("type") in {"goal", "shotontarget", "shotofftarget", "shotblocked"}:
            kind = "pressure" if rng.random() < 0.55 else "pass"
        elif i == 0 and prev.get("type") in {"goal_kick", "throwin", "kickoff", "periodstart"}:
            kind = "possession"
        else:
            kind = rng.choices(
                ["pass", "pass", "pass", "possession", "pressure", "tackle"],
                weights=[38, 20, 12, 12, 10, 8],
            )[0]

        # Drift toward next incident, with lateral wobble.
        target_x = px + (nx - px) * t
        target_y = py + (ny - py) * t
        wobble = 7.5 if kind == "pass" else 4.0
        x = clamp(target_x + rng.uniform(-wobble, wobble))
        y = clamp(target_y + rng.uniform(-wobble * 0.8, wobble * 0.8))

        # Keep home attacking rightward bias when building to a home chance.
        if cur_team == "home" and nxt.get("team") == "home" and nxt.get("type") in {
            "goal",
            "shotontarget",
            "shotofftarget",
            "shotblocked",
            "corner",
        }:
            x = max(x, clamp(40 + 45 * t))
        if cur_team == "away" and nxt.get("team") == "away" and nxt.get("type") in {
            "goal",
            "shotontarget",
            "shotofftarget",
            "shotblocked",
            "corner",
        }:
            x = min(x, clamp(60 - 45 * t))

        player = pick_player(cur_team, minute, avoid=player if kind == "pass" else None)
        extra: dict = {}
        if kind == "pass":
            d = dist((px, py), (x, y)) if out else dist((px, py), (x, y))
            if out:
                last = out[-1]
                d = dist((last["x"], last["y"]), (x, y))
            toward = (cur_team == "home" and x > px) or (cur_team == "away" and x < px)
            extra = {
                "outcome": "complete",
                "distance": round(d, 1),
                "difficulty": difficulty_for(d, toward),
                "speed": round(rng.uniform(38, 72), 1),
            }
            text = fill_phrase(rng.choice(PASS_TEXT), cur_team, player)
        elif kind == "pressure":
            text = fill_phrase(rng.choice(PRESS_TEXT), cur_team, player)
        elif kind == "tackle":
            text = fill_phrase(rng.choice(TACKLE_TEXT), cur_team, player)
            extra = {"outcome": "won"}
        elif kind == "interception":
            text = fill_phrase(rng.choice(INTERCEPT_TEXT), cur_team, player)
            extra = {"outcome": "won"}
        else:
            text = fill_phrase(rng.choice(POSSESSION_TEXT), cur_team, player)

        # Avoid colliding with prev/next minute+type noise: nudge added if same minute as both ends.
        if minute == p_min and not added and gap >= 1:
            # place slightly after prev within the minute window via fractional added encoding
            # keep integer minutes; rely on ordering in list
            pass

        out.append(
            event(kind, cur_team, minute, added, x, y, player, text, score, **extra)
        )
        px, py = x, y

    return out


def opening_kickoff_build(score: dict) -> list[dict]:
    """First-minute texture so the match doesn't jump to a throw-in."""
    team = "home"
    chain = [
        ("possession", 0, 0, 52, 50, "Santos, Paulo", "{club} knock it around from kick-off."),
        ("pass", 0, 0, 48, 42, "Quinn, Miles", "{player} drops deep and starts the move."),
        ("pass", 1, 0, 55, 58, "Navarro, Diego", "{player} pushes Northbridge into the right channel."),
        ("pressure", 1, 0, 61, 55, "Adeyemi, Tunde", "{player} looks to press on from midfield."),
    ]
    rows = []
    for kind, minute, added, x, y, player, tmpl in chain:
        extra = {}
        if kind == "pass":
            extra = {
                "outcome": "complete",
                "distance": round(rng.uniform(10, 22), 1),
                "difficulty": "easy",
                "speed": round(rng.uniform(40, 58), 1),
            }
        rows.append(
            event(
                kind,
                team,
                minute,
                added,
                x,
                y,
                player,
                fill_phrase(tmpl, team, player),
                score,
                **extra,
            )
        )
    return rows


def pre_goal_boost(events: list[dict]) -> list[dict]:
    """Ensure each goal has a short authored build-up immediately before it."""
    out: list[dict] = []
    for i, ev in enumerate(events):
        if ev.get("type") == "goal" and ev.get("team"):
            team = ev["team"]
            minute = ev.get("minute") or 0
            added = ev.get("added") or 0
            score = ev.get("score") or {"home": 0, "away": 0}
            # Use previous scoreline for build-up rows.
            build_score = deepcopy(score)
            if team == "home":
                build_score["home"] = max(0, (build_score.get("home") or 0) - 1)
            else:
                build_score["away"] = max(0, (build_score.get("away") or 0) - 1)

            gx = float(ev.get("x") or attack_x(team, 90))
            gy = float(ev.get("y") or 50)
            scorer = ev.get("player") or pick_player(team, minute)
            helpers = [p for p in pool_for(team, minute) if p != scorer]
            rng.shuffle(helpers)
            a, b, c = (helpers + [scorer, scorer, scorer])[:3]

            build = [
                event(
                    "pass",
                    team,
                    minute,
                    added,
                    clamp(gx - (18 if team == "home" else -18)),
                    clamp(gy + rng.uniform(-12, 12)),
                    a,
                    fill_phrase("{player} drives {club} forward.", team, a),
                    build_score,
                    outcome="complete",
                    distance=16.0,
                    difficulty="medium",
                    speed=58.0,
                ),
                event(
                    "pass",
                    team,
                    minute,
                    added,
                    clamp(gx - (10 if team == "home" else -10)),
                    clamp(gy + rng.uniform(-8, 8)),
                    b,
                    fill_phrase("{player} slips it into the box.", team, b),
                    build_score,
                    outcome="complete",
                    distance=11.0,
                    difficulty="hard",
                    speed=64.0,
                ),
                event(
                    "pressure",
                    team,
                    minute,
                    added,
                    clamp(gx - (5 if team == "home" else -5)),
                    clamp(gy + rng.uniform(-5, 5)),
                    c,
                    fill_phrase("The box is crowded — {player} keeps the chance alive.", team, c),
                    build_score,
                ),
            ]
            # Skip if previous rows already look like a build (pass/pressure same minute).
            prev = out[-1] if out else None
            if not (
                prev
                and prev.get("minute") == minute
                and prev.get("type") in {"pass", "pressure", "shotontarget"}
                and prev.get("team") == team
            ):
                out.extend(build)
        out.append(ev)
    return out


def stitch(match: dict) -> dict:
    base = deepcopy(match)
    events = list(base.get("events") or [])
    score = {"home": 0, "away": 0}

    # Track live score from events for inserted rows.
    stitched: list[dict] = []
    for i, ev in enumerate(events):
        if ev.get("score"):
            score = {
                "home": ev["score"].get("home", score["home"]),
                "away": ev["score"].get("away", score["away"]),
            }
            if "ht" in ev["score"]:
                score["ht"] = ev["score"]["ht"]

        if i == 0 and ev.get("type") == "periodstart":
            stitched.append(ev)
            stitched.extend(opening_kickoff_build({"home": 0, "away": 0}))
            continue

        if stitched:
            prev = stitched[-1]
            # Use pre-goal score for fillers before a goal event.
            fill_score = deepcopy(score)
            if ev.get("type") == "goal" and ev.get("team") == "home":
                fill_score["home"] = max(0, (ev.get("score") or {}).get("home", 1) - 1)
            elif ev.get("type") == "goal" and ev.get("team") == "away":
                fill_score["away"] = max(0, (ev.get("score") or {}).get("away", 1) - 1)
            stitched.extend(sequence_between(prev, ev, fill_score))

        stitched.append(ev)

    stitched = pre_goal_boost(stitched)

    # Deduplicate exact same type/minute/player/xy stacks that can appear from boosts.
    deduped: list[dict] = []
    seen = set()
    for row in stitched:
        key = (
            row.get("type"),
            row.get("minute"),
            row.get("added"),
            row.get("team"),
            row.get("player"),
            row.get("x"),
            row.get("y"),
            row.get("text"),
        )
        if key in seen and row.get("type") in {"pass", "pressure", "possession", "tackle", "interception"}:
            continue
        seen.add(key)
        deduped.append(row)

    base["events"] = deduped
    base["situations"] = []
    base["away"]["color"] = base.get("away", {}).get("color") or "#1a2c7e"
    return base


def write_lean(match: dict, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    lean = deepcopy(match)
    lean["situations"] = []
    path.write_text(json.dumps(lean, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {path} ({len(lean['events'])} events)")


def main() -> None:
    match = json.loads(SRC.read_text())
    before = len(match.get("events") or [])
    enriched = stitch(match)
    after = len(enriched["events"])
    types = {}
    for e in enriched["events"]:
        types[e["type"]] = types.get(e["type"], 0) + 1
    print(f"events {before} -> {after}")
    print("types:", dict(sorted(types.items(), key=lambda kv: -kv[1])))
    write_lean(enriched, OUT_DIST)
    write_lean(enriched, OUT_SEED)


if __name__ == "__main__":
    main()
