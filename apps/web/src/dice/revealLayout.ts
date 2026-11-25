import { MAX_DICE, type Face, type PlayerId } from "@perudo/engine";

/** A player's revealed dice as the server sends them; `counts` is the server's marking, never recomputed here. */
export interface RevealLayoutPlayer {
  id: PlayerId;
  dice: readonly { face: Face; counts: boolean }[];
}

export type Vec3 = [number, number, number];

export interface PlacedDie {
  face: Face;
  counts: boolean;
  /** Centre of the die, resting on the table (y = 0). */
  position: Vec3;
}

export interface RevealGroup {
  id: PlayerId;
  /** Flat strip on the table for the player's name: centre (x, z) and size. */
  label: { x: number; z: number; width: number; depth: number };
  dice: PlacedDie[];
}

export interface RevealLayout {
  groups: RevealGroup[];
  /** Extent of the whole layout on the table (x and z), centred on the origin. */
  width: number;
  depth: number;
}

/** Table units (a die is 1 x 1 x 1). */
const DIE = 1;
/** Centre-to-centre distance between dice in a row. */
const DIE_PITCH = 1.25;
/** Depth of the strip above each row that holds the player's name. */
const LABEL_DEPTH = 0.6;
/** Between the name and the dice; wide enough that the dice don't hide the name from the (tilted) camera. */
const LABEL_GAP = 0.5;
/** Depth of one player's group: name strip, gap, row of dice. */
const GROUP_DEPTH = LABEL_DEPTH + LABEL_GAP + DIE;
/** Space between one group's dice and the next group's name. */
const ROW_GAP = 0.6;
/** Space between columns of groups. */
const COLUMN_GAP = 1.5;

/**
 * Where each die goes on the reveal table: one row of dice per player under a strip for their name,
 * groups in Seat order in reading order over `columns` columns (left to right, then the next row),
 * the whole layout centred on the origin. Pure: no three.js.
 */
export function revealLayout(players: readonly RevealLayoutPlayer[], columns: number): RevealLayout {
  const longestRow = Math.max(MAX_DICE, ...players.map((p) => p.dice.length));
  const { cols, columnWidth, width, depth } = extent(players.length, columns, longestRow);
  return {
    width,
    depth,
    groups: players.map((player, seat) => {
      const left = -width / 2 + (seat % cols) * (columnWidth + COLUMN_GAP);
      const top = -depth / 2 + Math.floor(seat / cols) * (GROUP_DEPTH + ROW_GAP);
      const diceZ = top + LABEL_DEPTH + LABEL_GAP + DIE / 2;
      return {
        id: player.id,
        label: { x: left + columnWidth / 2, z: top + LABEL_DEPTH / 2, width: columnWidth, depth: LABEL_DEPTH },
        dice: player.dice.map((die, i) => ({
          face: die.face,
          counts: die.counts,
          position: [left + DIE / 2 + i * DIE_PITCH, DIE / 2, diceZ],
        })),
      };
    }),
  };
}

function extent(playerCount: number, columns: number, longestRow = MAX_DICE) {
  const cols = Math.max(1, Math.min(columns, playerCount));
  const rows = Math.ceil(playerCount / cols);
  const columnWidth = (longestRow - 1) * DIE_PITCH + DIE;
  const width = cols * columnWidth + (cols - 1) * COLUMN_GAP;
  const depth = rows * GROUP_DEPTH + Math.max(0, rows - 1) * ROW_GAP;
  return { cols, columnWidth, width, depth };
}

/** Most columns ever tried: beyond three, names and dice get too small on any screen. */
const MAX_COLUMNS = 3;

/**
 * How much of the table (in table units, front to back) the camera must take in to show a layout
 * on a stage of this aspect ratio (width / height), seen roughly from above.
 */
export function viewSpan(size: { width: number; depth: number }, aspect: number): number {
  return Math.max(size.depth, size.width / aspect);
}

/** The number of columns that lets the camera come closest (biggest dice), preferring fewer on a tie. */
export function revealColumns(playerCount: number, aspect: number): number {
  let best = 1;
  for (let cols = 2; cols <= Math.min(MAX_COLUMNS, playerCount); cols++) {
    if (viewSpan(extent(playerCount, cols), aspect) < viewSpan(extent(playerCount, best), aspect)) best = cols;
  }
  return best;
}
