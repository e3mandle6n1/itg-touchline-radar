import { describe, expect, it } from "vitest";
import {
  ballAt,
  buildIncidentTimeline,
  buildPlayTrack,
  dwellFor,
  groupTimelinePeriods,
  incidentIndexAtPlay,
  liveTimelineRows,
  minuteAt,
  scoreAt,
  situationPhase,
} from "../../src/match/track.js";

const matchShell = {
  home: { name: "Northbridge" },
  away: { name: "Rivermark" },
};

describe("buildPlayTrack", () => {
  it("situations + keeper promote", () => {
    const track = buildPlayTrack({
      ...matchShell,
      situations: [
        {
          incident: "shotontarget",
          team: "home",
          minute: 10,
          x: 80,
          y: 50,
          text: "The goalkeeper saves",
        },
        { incident: "goal", team: "home", minute: 22, x: 88, y: 48, text: "Goal" },
      ],
    });
    expect(track[0]).toMatchObject({ incident: "goalkeeper_saved", team: "away" });
    expect(track[1].incident).toBe("goal");
  });

  it("stamps shootout after pen period start", () => {
    const track = buildPlayTrack({
      ...matchShell,
      situations: [
        {
          incident: "periodstart",
          clock: "Penalties",
          minute: 90,
          added: 5,
          text: "We go to a penalty shoot-out.",
        },
        { incident: "goal", team: "home", minute: 90, added: 6, player: "A" },
        { incident: "shotofftarget", team: "away", minute: 90, added: 7, player: "B" },
      ],
    });
    expect(track[0]).toMatchObject({ shootout: true, period: "penalties" });
    expect(track[1]).toMatchObject({ shootout: true, incident: "goal", team: "home" });
    expect(track[2]).toMatchObject({ shootout: true, incident: "shotofftarget", team: "away" });
  });

  it("FK text in own half", () => {
    const [row] = buildPlayTrack({
      ...matchShell,
      situations: [
        {
          incident: "freekick",
          team: "home",
          minute: 15,
          x: 25,
          y: 50,
          text: "Dangerous free kick in shooting range",
        },
      ],
    });
    expect(row.text).toBe("Northbridge awarded a free kick in their own half.");
  });

  it("throw-in text stays plain in the team's own half", () => {
    const [row] = buildPlayTrack({
      ...matchShell,
      situations: [
        {
          incident: "throwin",
          team: "home",
          minute: 7,
          x: 20,
          y: 6,
          text: "Northbridge have an attacking throw-in.",
        },
      ],
    });
    expect(row.text).toBe("Throw-in for Northbridge.");
  });

  it("events fallback", () => {
    const track = buildPlayTrack({
      ...matchShell,
      events: [
        { type: "periodstart", clock: "1st half", minute: 0 },
        { type: "goal", team: "home", minute: 12, x: 90, y: 50 },
      ],
    });
    expect(track.map((row) => row.type || row.incident)).toEqual([
      "periodstart",
      "goal",
    ]);
  });
});

describe("buildIncidentTimeline / incidentIndexAtPlay", () => {
  it("skips kickoff / bare phase", () => {
    const marks = buildIncidentTimeline([
      { incident: "kickoff", minute: 0 },
      { phase: "attack", type: "match_action", minute: 1 },
        { incident: "goal", team: "home", minute: 12, text: "Goal Northbridge" },
      { incident: "card", team: "away", minute: 30 },
    ]);
    expect(marks).toHaveLength(2);
    expect(marks[0]).toMatchObject({ type: "goal", playIndex: 2 });
    expect(marks[1].playIndex).toBe(3);
  });

  it("mark at play index", () => {
    const marks = [
      { playIndex: 2 },
      { playIndex: 5 },
      { playIndex: 9 },
    ];
    expect(incidentIndexAtPlay(marks, 0)).toBe(0);
    expect(incidentIndexAtPlay(marks, 5)).toBe(1);
    expect(incidentIndexAtPlay(marks, 8)).toBe(1);
    expect(incidentIndexAtPlay(marks, 20)).toBe(2);
  });
});

describe("liveTimelineRows", () => {
  const marks = [
    { type: "goal", text: "early", playIndex: 2 },
    { type: "card", text: "mid", playIndex: 5 },
    { type: "goal", text: "late", playIndex: 9 },
    { type: "card", text: "future", playIndex: 12 },
  ];

  it("hides future marks and puts newest first", () => {
    const rows = liveTimelineRows(marks, 2);
    expect(rows.map((row) => row.text)).toEqual(["late", "mid", "early"]);
    expect(rows[0].markIndex).toBe(2);
  });

  it("empty before anything has happened", () => {
    expect(liveTimelineRows(marks, -1)).toEqual([]);
    expect(liveTimelineRows([], 0)).toEqual([]);
  });
});

describe("groupTimelinePeriods", () => {
  it("period groups + score", () => {
    const periods = groupTimelinePeriods([
      { incident: "periodstart", clock: "1st half" },
      { incident: "goal", team: "home", type: "goal" },
      { incident: "periodscore", clock: "Half Time" },
      { incident: "periodstart", clock: "2nd half" },
      { incident: "goal", team: "away", type: "goal" },
      { incident: "periodscore", clock: "Full Time" },
    ]);
    expect(periods.map((p) => p.id)).toEqual(["2h", "1h"]);
    expect(periods.find((p) => p.id === "1h").score).toEqual({ home: 1, away: 0 });
    expect(periods.find((p) => p.id === "2h").score).toEqual({ home: 1, away: 1 });
  });
});

describe("situationPhase", () => {
  it("phase from depth and direction", () => {
    expect(situationPhase({ incident: "goal", team: "home", x: 90 }, { x: 90 })).toBeNull();
    expect(situationPhase({ type: "match_action", team: "home" }, { x: 68 })).toBe("attack");
    expect(situationPhase({ type: "match_action", team: "home" }, { x: 80 })).toBe("dangerous");
    expect(situationPhase({ type: "match_action", team: "home" }, { x: 50 })).toBe("safe");
    expect(situationPhase({ type: "throwin", team: "home" }, { x: 90 })).toBe("dangerous");
    expect(situationPhase({ type: "goal_kick", team: "home" }, { x: 10 })).toBe("safe");
    expect(situationPhase({ type: "match_action", team: "away" }, { x: 20 }, { x: 10 })).toBe("safe");
    expect(situationPhase({ type: "match_action", team: "home" }, { x: 80 }, { x: 88 })).toBe("safe");
    expect(situationPhase({ type: "match_action", team: "home" }, { x: 82 }, { x: 80 })).toBe("dangerous");
  });
});

describe("scoreAt / minuteAt / ballAt / dwellFor", () => {
  const timeline = [
    { incident: "periodstart", minute: 0 },
    { incident: "goal", team: "home", minute: 12, x: 90, y: 48 },
    { incident: "goal", team: "away", minute: 55, x: 10, y: 52 },
    { incident: "card", team: "home", minute: 70 },
  ];

  it("score through index", () => {
    expect(scoreAt(timeline, 0)).toEqual({ home: 0, away: 0 });
    expect(scoreAt(timeline, 1)).toEqual({ home: 1, away: 0 });
    expect(scoreAt(timeline, 3)).toEqual({ home: 1, away: 1 });
  });

  it("minute / finished", () => {
    expect(minuteAt([], 0)).toBe(0);
    expect(minuteAt(timeline, 2)).toBe(55);
    expect(minuteAt(timeline, 3)).toBe(200);
    expect(minuteAt(timeline, 99)).toBe(200);
    expect(minuteAt(timeline, 3, { complete: false })).toBe(70);
  });

  it("last known ball", () => {
    expect(ballAt([], 0)).toEqual({ x: 50, y: 50 });
    expect(ballAt(timeline, 3)).toEqual({ x: 10, y: 52 });
    expect(ballAt([{ incident: "card" }], 0)).toEqual({ x: 50, y: 50 });
  });

  it("set-piece dwell", () => {
    const ms = dwellFor(
      { incident: "corner", team: "home", y: 20, cornerKick: true },
      { x: 50, y: 50 },
      { x: 90, y: 10 },
    );
    expect(ms).toBeGreaterThan(1000);
  });
});
