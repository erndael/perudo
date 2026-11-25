import { describe, expect, it } from "vitest";
import { revealColumns, revealLayout, type RevealLayoutPlayer } from "./revealLayout.ts";

/** Positions rounded so float noise (0.6 + 0.2) doesn't matter. */
const at = (p: readonly number[]) => p.map((n) => Math.round(n * 1000) / 1000);

const player = (id: string, ...faces: number[]): RevealLayoutPlayer => ({
  id,
  dice: faces.map((face, i) => ({ face: face as 1, counts: i % 2 === 0 })),
});

describe("revealLayout", () => {
  it("lays one player's dice in a row, in roll order, resting on the table, with the server's marking", () => {
    const layout = revealLayout(
      [
        {
          id: "p1",
          dice: [
            { face: 6, counts: true },
            { face: 2, counts: false },
            { face: 1, counts: true },
          ],
        },
      ],
      1,
    );

    expect(layout.groups).toHaveLength(1);
    const [group] = layout.groups;
    expect(group!.id).toBe("p1");
    expect(group!.dice.map((d) => [d.face, d.counts, at(d.position)])).toEqual([
      [6, true, [-2.5, 0.5, 0.55]],
      [2, false, [-1.25, 0.5, 0.55]],
      [1, true, [0, 0.5, 0.55]],
    ]);
  });

  it("stacks players in Seat order from the back of the table, each with a name strip above their row, clear of the dice", () => {
    const layout = revealLayout([player("p1", 3, 3), player("p2", 5)], 1);

    expect(layout.groups.map((g) => g.id)).toEqual(["p1", "p2"]);
    const [ana, ben] = layout.groups;
    expect(ana!.dice.map((d) => at(d.position))).toEqual([
      [-2.5, 0.5, -0.8],
      [-1.25, 0.5, -0.8],
    ]);
    expect(ben!.dice.map((d) => at(d.position))).toEqual([[-2.5, 0.5, 1.9]]);
    // Name strips span the full column width, left-aligned with the dice.
    expect([ana!.label, ben!.label].map((l) => [...at([l.x, l.z]), l.width, l.depth])).toEqual([
      [0, -2.1, 6, 0.6],
      [0, 0.6, 6, 0.6],
    ]);
    expect(layout.width).toBe(6);
    expect(at([layout.depth])).toEqual([4.8]);
  });

  it("spreads players over columns in reading order (Seat order left to right, then the next row)", () => {
    const layout = revealLayout([player("p1", 2), player("p2", 2), player("p3", 2), player("p4", 2), player("p5", 2)], 2);

    const firstDie = (i: number) => at(layout.groups[i]!.dice[0]!.position);
    expect([0, 1, 2, 3, 4].map(firstDie)).toEqual([
      [-6.25, 0.5, -2.15],
      [1.25, 0.5, -2.15],
      [-6.25, 0.5, 0.55],
      [1.25, 0.5, 0.55],
      [-6.25, 0.5, 3.25],
    ]);
    expect(at([layout.groups[1]!.label.x, layout.groups[1]!.label.z])).toEqual([3.75, -3.45]);
    expect([layout.width, at([layout.depth])[0]]).toEqual([13.5, 7.5]);
  });

  it("never uses more columns than there are players", () => {
    const layout = revealLayout([player("p1", 4)], 2);
    expect(layout.width).toBe(6);
    expect(at(layout.groups[0]!.dice[0]!.position)).toEqual([-2.5, 0.5, 0.55]);
  });
});

describe("revealColumns", () => {
  it("stacks everyone in one column on a narrow (phone) stage", () => {
    expect(revealColumns(4, 0.9)).toBe(1);
    expect(revealColumns(2, 0.9)).toBe(1);
  });

  it("spreads groups side by side on a wide stage", () => {
    expect(revealColumns(2, 3.5)).toBe(2);
    expect(revealColumns(4, 3.5)).toBe(2);
    expect(revealColumns(6, 3.5)).toBe(3);
  });
});
