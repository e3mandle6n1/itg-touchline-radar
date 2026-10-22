import { describe, expect, it } from "vitest";
import {
  cardSpot,
  hasSitover,
  holdFor,
  iconFor,
  incidentTitle,
  isCardEvent,
  isShootoutGoal,
  momentumIcon,
  partitionTitle,
} from "../../src/match/events.js";

describe("hasSitover", () => {
  it("highlight + phase => sitover", () => {
    expect(hasSitover({ incident: "goal", phase: "attack" })).toBe(true);
    expect(hasSitover({ incident: "corner", phase: "dangerous" })).toBe(false);
  });

  it("sitover set without phase", () => {
    expect(hasSitover({ type: "corner" })).toBe(true);
    expect(hasSitover({ type: "throwin" })).toBe(false);
  });
});

describe("isCardEvent / cardSpot", () => {
  it("is card", () => {
    expect(isCardEvent({ incident: "card" })).toBe(true);
    expect(isCardEvent({ type: "goal" })).toBe(false);
  });

  it("coords or team default", () => {
    expect(cardSpot({ incident: "card", x: 10, y: 90 })).toEqual({ x: 10, y: 90 });
    expect(cardSpot({ incident: "card", team: "away" })).toEqual({ x: 58, y: 50 });
    expect(cardSpot({ incident: "card", team: "home" })).toEqual({ x: 42, y: 50 });
    expect(cardSpot({ incident: "goal" })).toBeNull();
  });
});

describe("isShootoutGoal", () => {
  it("needs a goal", () => {
    expect(isShootoutGoal({ incident: "card", shootout: true })).toBe(false);
  });

  it("shootout flag/period/text", () => {
    expect(isShootoutGoal({ incident: "goal", shootout: true })).toBe(true);
    expect(isShootoutGoal({ incident: "goal", period: "penalties" })).toBe(true);
    expect(isShootoutGoal({ incident: "goal", text: "Penalty shoot-out" })).toBe(true);
    expect(isShootoutGoal({ incident: "goal", text: "Open play" })).toBe(false);
  });
});

describe("incidentTitle / iconFor / momentumIcon", () => {
  it("card titles", () => {
    expect(incidentTitle({ incident: "card", card: "red" })).toBe("Red card");
    expect(incidentTitle({ incident: "card", card: "yellowred" })).toBe("Second yellow");
    expect(incidentTitle({ incident: "card" })).toBe("Yellow card");
    expect(incidentTitle({ incident: "goal" })).toBe("Goal");
  });

  it("icons", () => {
    expect(iconFor({ incident: "card", card: "red" })).toBe("red-card");
    expect(iconFor({ incident: "card" })).toBe("yellow-card");
    expect(iconFor({ incident: "goal" })).toBe("goal");
  });

  it("momentum icons", () => {
    expect(momentumIcon({ type: "goal" })).toBe("goal");
    expect(momentumIcon({ type: "card", card: "yellow" })).toBe("yellow-card");
    expect(momentumIcon({ type: "card", card: "red" })).toBe("red-card");
  });
});

describe("holdFor", () => {
  it("goal long, action short", () => {
    expect(holdFor({ incident: "goal" })).toBe(3400);
    expect(holdFor({ incident: "match_action" })).toBe(320);
    expect(holdFor({ incident: "card", withFreeKick: true })).toBe(2800);
    expect(holdFor(null)).toBe(280);
  });

  it("half changes hold for the flag", () => {
    expect(holdFor({ incident: "periodstart", clock: "1st half", minute: 0 })).toBe(4200);
    expect(holdFor({ incident: "periodstart", clock: "2nd half" })).toBe(4200);
    expect(holdFor({ incident: "periodscore", clock: "1st half" })).toBe(2200);
    expect(holdFor({ incident: "match_ended" })).toBe(700);
  });
});

describe("partitionTitle", () => {
  it("names each period boundary", () => {
    expect(partitionTitle({ incident: "periodstart", clock: "1st half", minute: 0 })).toBe(
      "Match has started",
    );
    expect(partitionTitle({ incident: "periodscore", clock: "1st half", minute: 45 })).toBe(
      "First half has ended",
    );
    expect(partitionTitle({ incident: "periodstart", clock: "2nd half", minute: 45 })).toBe(
      "Second half has started",
    );
    expect(partitionTitle({
      incident: "periodscore",
      clock: "Full Time",
      minute: 90,
      text: "Still 0-0 after 90. Extra time.",
    })).toBe("Second half has ended");
    expect(partitionTitle({
      incident: "periodstart",
      clock: "Extra time · 1st half",
      minute: 90,
    })).toBe("Extra time has started");
    expect(partitionTitle({
      incident: "periodscore",
      clock: "Extra time",
      minute: 105,
      text: "End of the first period of extra time.",
    })).toBe("First half of extra time has ended");
    expect(partitionTitle({
      incident: "periodstart",
      clock: "Extra time · 2nd half",
      minute: 105,
    })).toBe("Second half of extra time has started");
    expect(partitionTitle({
      incident: "periodscore",
      clock: "Extra Time",
      minute: 120,
      text: "No winner in extra time. Penalties.",
    })).toBe("Extra time has ended");
  });

  it("leaves penalties and open play alone", () => {
    expect(partitionTitle({
      incident: "periodstart",
      clock: "Penalties",
      text: "We go to a penalty shoot-out.",
    })).toBeNull();
    expect(partitionTitle({ incident: "kickoff", minute: 23, clock: "23'" })).toBeNull();
    expect(partitionTitle({ incident: "goal", team: "home" })).toBeNull();
  });
});
