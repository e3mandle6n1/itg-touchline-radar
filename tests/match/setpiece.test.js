import { describe, expect, it } from "vitest";
import {
  cornerQuad,
  dedupeCornerAwards,
  isSetPieceKickMoment,
  linkFreeKickCards,
  markSetPieces,
  setPieceDeliveryTarget,
  setPieceDwellMs,
  setPieceFunnelBars,
  setPieceFunnelPolygon,
  setPieceSpot,
} from "../../src/match/setpiece.js";

describe("dedupeCornerAwards", () => {
  it("dedupes corner awards", () => {
    const track = [
      { incident: "corner", team: "home", minute: 12, x: 90, y: 10, text: "Corner awarded" },
      { incident: "corner", team: "home", minute: 12, x: 91, y: 11, text: "Corner to Northbridge" },
      { incident: "corner", team: "home", minute: 12, x: 96, y: 5, text: "Okoro takes a corner" },
    ];
    const out = dedupeCornerAwards(track);
    expect(out).toHaveLength(2);
    expect(out[1].text).toMatch(/takes a corner/);
  });
});

describe("markSetPieces", () => {
  it("deep FK + fill taken coords", () => {
    const out = markSetPieces([
      { incident: "freekick", team: "home", minute: 20, x: 78, y: 50, text: "Free kick awarded" },
      {
        incident: "freekick_taken",
        team: "home",
        minute: 20,
        added: 1,
        text: "Takes the free-kick",
      },
    ]);
    expect(out[1]).toMatchObject({ x: 78, y: 50 });
    expect(out[0].freeKick).toBe(false);
  });

  it("shallow FK not threat", () => {
    const [row] = markSetPieces([
      { incident: "freekick", team: "home", x: 30, y: 50, text: "Free kick" },
    ]);
    expect(row.freeKick).toBe(false);
  });
});

describe("linkFreeKickCards", () => {
  it("card links to FK", () => {
    const out = linkFreeKickCards([
      { incident: "freekick", team: "home", minute: 33, x: 60, y: 40 },
      { incident: "card", team: "away", minute: 33, card: "yellow" },
    ]);
    expect(out[1]).toMatchObject({
      withFreeKick: true,
      foulTeam: "home",
      foulSpot: { x: 60, y: 40 },
    });
    expect(out[0]).toMatchObject({ leadsToCard: true, freeKick: true });
  });
});

describe("setPieceSpot / delivery / kick moment", () => {
  it("spot: flag or coords", () => {
    expect(setPieceSpot({ incident: "corner", team: "home", y: 20 })).toEqual({
      x: 98.5,
      y: 2.34375,
    });
    expect(setPieceSpot({ incident: "freekick", team: "home", x: 70, y: 40 })).toEqual({
      x: 70,
      y: 40,
    });
  });

  it("delivery toward box", () => {
    expect(
      setPieceDeliveryTarget({ incident: "corner", team: "home", y: 20 }),
    ).toEqual({ x: 86, y: 36 });
    expect(
      setPieceDeliveryTarget({ incident: "freekick", team: "away", x: 30, y: 50 }),
    ).toMatchObject({ x: 14 });
  });

  it("kick moments", () => {
    expect(isSetPieceKickMoment({ incident: "corner", cornerKick: true })).toBe(true);
    expect(
      isSetPieceKickMoment({ incident: "corner", text: "Okoro takes a corner" }),
    ).toBe(true);
    expect(
      isSetPieceKickMoment({ incident: "freekick_taken", text: "Takes the free-kick" }),
    ).toBe(true);
    expect(
      isSetPieceKickMoment({ incident: "corner", cornerKick: false, text: "Corner awarded" }),
    ).toBe(false);
  });
});

describe("setPieceDwellMs", () => {
  it("null for non set-piece", () => {
    expect(setPieceDwellMs({ x: 50, y: 50 }, { incident: "goal" })).toBeNull();
  });

  it("take dwell > award", () => {
    const from = { x: 50, y: 50 };
    const award = setPieceDwellMs(from, {
      incident: "corner",
      team: "home",
      y: 20,
      cornerKick: false,
      text: "Corner awarded",
    });
    const take = setPieceDwellMs(from, {
      incident: "corner",
      team: "home",
      y: 20,
      cornerKick: true,
      text: "Takes a corner",
    });
    expect(take).toBeGreaterThan(award);
  });
});

describe("funnel helpers", () => {
  it("funnel poly + bars", () => {
    const poly = setPieceFunnelPolygon({ x: 96.8, y: 3.2 }, "home", "corner");
    expect(poly).toMatchObject({ tipSide: expect.any(String) });
    expect(poly.points.split(" ")).toHaveLength(3);
    expect(setPieceFunnelBars(poly, 3)).toHaveLength(3);
  });

  it("corner quadrants", () => {
    expect(cornerQuad({ x: 5, y: 5 })).toBe("tl");
    expect(cornerQuad({ x: 95, y: 5 })).toBe("tr");
    expect(cornerQuad({ x: 5, y: 95 })).toBe("bl");
    expect(cornerQuad({ x: 95, y: 95 })).toBe("br");
    expect(cornerQuad(null)).toBe("br");
  });
});
