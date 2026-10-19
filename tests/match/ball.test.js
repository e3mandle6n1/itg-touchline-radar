import { describe, expect, it } from "vitest";
import {
  centreSpot,
  goalNetTarget,
  isRestart,
  isShotAttempt,
  promoteKeeperSaves,
  saveSpot,
  shotFlightTarget,
  shotOrigin,
  travelMs,
} from "../../src/match/ball.js";

describe("travelMs", () => {
  it("missing point -> 0", () => {
    expect(travelMs(null, { x: 1, y: 1 })).toBe(0);
    expect(travelMs({ x: 1, y: 1 }, null)).toBe(0);
  });

  it("tiny gap -> 50", () => {
    expect(travelMs({ x: 50, y: 50 }, { x: 50.1, y: 50 })).toBe(50);
  });

  it("scales with distance", () => {
    const short = travelMs({ x: 10, y: 50 }, { x: 20, y: 50 });
    const long = travelMs({ x: 10, y: 50 }, { x: 90, y: 50 });
    expect(long).toBeGreaterThan(short);
    expect(short).toBeGreaterThan(50);
  });
});

describe("goalNetTarget", () => {
  it("null if not a goal", () => {
    expect(goalNetTarget({ incident: "shotontarget", team: "home" })).toBeNull();
    expect(goalNetTarget({ incident: "goal" })).toBeNull();
  });

  it("home right net, away left", () => {
    expect(goalNetTarget({ incident: "goal", team: "home", y: 50 })).toEqual({
      x: 98.5,
      y: 50,
    });
    expect(goalNetTarget({ type: "goal", team: "away", y: 50 })).toEqual({
      x: 1.5,
      y: 50,
    });
  });

  it("net Y clamped", () => {
    expect(goalNetTarget({ incident: "goal", team: "home", y: 0 }).y).toBe(44);
    expect(goalNetTarget({ incident: "goal", team: "home", y: 100 }).y).toBe(56);
  });
});

describe("shotFlightTarget", () => {
  it("null without shot inputs", () => {
    expect(shotFlightTarget({ incident: "goal", team: "home", x: 80, y: 50 })).toBeNull();
    expect(shotFlightTarget({ incident: "shotontarget", x: 80, y: 50 })).toBeNull();
    expect(shotFlightTarget({ incident: "shotontarget", team: "home", y: 50 })).toBeNull();
  });

  it("on target toward goal", () => {
    expect(
      shotFlightTarget({ incident: "shotontarget", team: "home", x: 80, y: 50 }),
    ).toMatchObject({ x: 97.2 });
    expect(
      shotFlightTarget({ incident: "shotontarget", team: "away", x: 20, y: 50 }),
    ).toMatchObject({ x: 2.8 });
  });

  it("off target goes wide", () => {
    const high = shotFlightTarget({
      incident: "shotofftarget",
      team: "home",
      x: 80,
      y: 30,
    });
    const low = shotFlightTarget({
      incident: "shotofftarget",
      team: "away",
      x: 20,
      y: 70,
    });
    expect(high.x).toBe(99.2);
    expect(high.y).toBeLessThanOrEqual(26);
    expect(low.x).toBe(0.8);
    expect(low.y).toBeGreaterThanOrEqual(74);
  });
});

describe("shotOrigin / isShotAttempt", () => {
  it("null without coords", () => {
    expect(shotOrigin({})).toBeNull();
    expect(shotOrigin({ x: 40 })).toBeNull();
  });

  it("clamps origin", () => {
    expect(shotOrigin({ x: 0, y: 100 })).toEqual({ x: 6, y: 94 });
  });

  it("shot attempt kinds", () => {
    expect(isShotAttempt({ incident: "shotontarget" })).toBe(true);
    expect(isShotAttempt({ type: "shotofftarget" })).toBe(true);
    expect(isShotAttempt({ incident: "goal" })).toBe(false);
  });
});

describe("saveSpot", () => {
  it("null unless keeper save", () => {
    expect(saveSpot({ incident: "shotontarget", team: "home" })).toBeNull();
    expect(saveSpot({ incident: "goalkeeper_saved" })).toBeNull();
  });

  it("save near goal", () => {
    expect(saveSpot({ incident: "goalkeeper_saved", team: "home", y: 50 })).toMatchObject({
      x: 3.5,
    });
    expect(saveSpot({ incident: "goalkeeper_saved", team: "away", y: 50 })).toMatchObject({
      x: 96.5,
    });
  });
});

describe("promoteKeeperSaves", () => {
  it("plain shots unchanged", () => {
    const row = { incident: "shotontarget", team: "home", text: "Shot on target" };
    expect(promoteKeeperSaves(row)).toBe(row);
  });

  it("save phrasing flips team", () => {
    expect(
      promoteKeeperSaves({
        incident: "shotontarget",
        team: "home",
        text: "The goalkeeper saves",
      }),
    ).toMatchObject({
      incident: "goalkeeper_saved",
      type: "goalkeeper_saved",
      team: "away",
    });
  });
});

describe("centreSpot / isRestart", () => {
  it("kick-off centre", () => {
    expect(centreSpot({ incident: "kickoff" })).toEqual({ x: 50, y: 50 });
    expect(centreSpot({ type: "periodstart" })).toEqual({ x: 50, y: 50 });
    expect(centreSpot({ incident: "goal" })).toBeNull();
  });

  it("restart kinds", () => {
    expect(isRestart({ incident: "kickoff" })).toBe(true);
    expect(isRestart({ incident: "periodstart" })).toBe(true);
    expect(isRestart({ incident: "corner" })).toBe(false);
  });
});
