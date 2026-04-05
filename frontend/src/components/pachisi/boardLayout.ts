/**
 * Static board layout for the 15×15 Pachisi grid.
 *
 * Board structure (15×15):
 *   - Home bases (6×6 corners): Red=top-left, Yellow=bottom-right
 *   - Arms (3 wide): top, right, bottom, left
 *   - Center (3×3): rows 6-8, cols 6-8
 *
 * Outer track: 52 squares, clockwise from Red's entry at position 0 = [6,1].
 * Red home col: positions 52-56, col 7 rows 5→1 (toward center).
 * Yellow home col: positions 64-68, row 7 cols 13→9 (toward center).
 * FINISH (100): center cell [7,7].
 */

export type CellRole =
  | "empty"
  | "track"
  | "safe"
  | "home_base_red"
  | "home_base_yellow"
  | "home_base_unused" // green/blue corners (not active in 2-player)
  | "home_col_red"
  | "home_col_yellow"
  | "center";

// ---------------------------------------------------------------------------
// Outer track: 52 positions clockwise from Red's entry
// ---------------------------------------------------------------------------
//
// Segment A: Left arm top row →  [row 6, cols 1-5]           positions  0- 4
// Segment B: Top arm left col ↑  [col 6, rows 5-0]           positions  5-10
// Segment C: Top edge →          [row 0, cols 7-8]           positions 11-12
// Segment D: Top arm right col ↓ [col 8, rows 1-5]           positions 13-17
// Segment E: Right arm top row → [row 6, cols 9-14]          positions 18-23
// Segment F: Right edge ↓        [col 14, rows 7-8]          positions 24-25
// Segment G: Right arm bottom ←  [row 8, cols 13-9]          positions 26-30
// Segment H: Bottom arm right ↓  [col 8, rows 9-14]          positions 31-36
// Segment I: Bottom edge ←       [row 14, cols 7-6]          positions 37-38
// Segment J: Bottom arm left ↑   [col 6, rows 13-9]          positions 39-43
// Segment K: Left arm bottom ←   [row 8, cols 5-0]           positions 44-49
// Segment L: Left edge ↑         [col 0, rows 7-6]           positions 50-51
//
// Safe squares (no capture): 0, 8, 13, 21, 26, 34, 39, 47
// Red door (HOME_COL_ENTRY_OUTER): position 50 = [7,0]
// Yellow door (HOME_COL_ENTRY_OUTER): position 24 = [7,14]

const OUTER_TRACK: [number, number][] = [
  // Segment A
  [6, 1],
  [6, 2],
  [6, 3],
  [6, 4],
  [6, 5],
  // Segment B
  [5, 6],
  [4, 6],
  [3, 6],
  [2, 6],
  [1, 6],
  [0, 6],
  // Segment C
  [0, 7],
  [0, 8],
  // Segment D
  [1, 8],
  [2, 8],
  [3, 8],
  [4, 8],
  [5, 8],
  // Segment E
  [6, 9],
  [6, 10],
  [6, 11],
  [6, 12],
  [6, 13],
  [6, 14],
  // Segment F
  [7, 14],
  [8, 14],
  // Segment G
  [8, 13],
  [8, 12],
  [8, 11],
  [8, 10],
  [8, 9],
  // Segment H
  [9, 8],
  [10, 8],
  [11, 8],
  [12, 8],
  [13, 8],
  [14, 8],
  // Segment I
  [14, 7],
  [14, 6],
  // Segment J
  [13, 6],
  [12, 6],
  [11, 6],
  [10, 6],
  [9, 6],
  // Segment K
  [8, 5],
  [8, 4],
  [8, 3],
  [8, 2],
  [8, 1],
  [8, 0],
  // Segment L
  [7, 0],
  [6, 0],
];

// Red home column: col 7 going up (rows 5→1)
const RED_HOME_COL: [number, number][] = [
  [5, 7],
  [4, 7],
  [3, 7],
  [2, 7],
  [1, 7],
];

// Yellow home column: row 7 going left (cols 13→9)
const YELLOW_HOME_COL: [number, number][] = [
  [7, 13],
  [7, 12],
  [7, 11],
  [7, 10],
  [7, 9],
];

/** Maps track position integer → [row, col] board coordinate */
export const TRACK_INDEX_TO_CELL: Record<number, [number, number]> = {};

// Outer track
OUTER_TRACK.forEach(([r, c], i) => {
  TRACK_INDEX_TO_CELL[i] = [r, c];
});

// Red home col: positions 52-56
RED_HOME_COL.forEach(([r, c], i) => {
  TRACK_INDEX_TO_CELL[52 + i] = [r, c];
});

// Yellow home col: positions 64-68
YELLOW_HOME_COL.forEach(([r, c], i) => {
  TRACK_INDEX_TO_CELL[64 + i] = [r, c];
});

// Finish → center
TRACK_INDEX_TO_CELL[100] = [7, 7];

// ---------------------------------------------------------------------------
// Cell roles
// ---------------------------------------------------------------------------

/** Maps "row,col" → CellRole for styling the 15×15 grid */
export const CELL_ROLES: Record<string, CellRole> = (() => {
  const roles: Record<string, CellRole> = {};
  const key = (r: number, c: number) => `${r},${c}`;

  // Default all cells to "empty"
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      roles[key(r, c)] = "empty";
    }
  }

  // Home bases
  for (let r = 0; r <= 5; r++) {
    for (let c = 0; c <= 5; c++) roles[key(r, c)] = "home_base_red";
  }
  for (let r = 9; r <= 14; r++) {
    for (let c = 9; c <= 14; c++) roles[key(r, c)] = "home_base_yellow";
  }
  for (let r = 0; r <= 5; r++) {
    for (let c = 9; c <= 14; c++) roles[key(r, c)] = "home_base_unused";
  }
  for (let r = 9; r <= 14; r++) {
    for (let c = 0; c <= 5; c++) roles[key(r, c)] = "home_base_unused";
  }

  // Outer track
  const safeIndices = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
  OUTER_TRACK.forEach(([r, c], i) => {
    roles[key(r, c)] = safeIndices.has(i) ? "safe" : "track";
  });

  // Home columns
  RED_HOME_COL.forEach(([r, c]) => {
    roles[key(r, c)] = "home_col_red";
  });
  YELLOW_HOME_COL.forEach(([r, c]) => {
    roles[key(r, c)] = "home_col_yellow";
  });

  // Center 3×3
  for (let r = 6; r <= 8; r++) {
    for (let c = 6; c <= 8; c++) {
      roles[key(r, c)] = "center";
    }
  }

  return roles;
})();

/** Safe square track indices — no capture allowed */
export const SAFE_TRACK_INDICES = new Set([0, 8, 13, 21, 26, 34, 39, 47]);

/** 4 piece-spawn slots inside each home base corner */
export const HOME_BASE_CELLS: Record<string, [number, number][]> = {
  red: [
    [1, 1],
    [1, 3],
    [3, 1],
    [3, 3],
  ],
  yellow: [
    [10, 10],
    [10, 12],
    [12, 10],
    [12, 12],
  ],
};

export const PLAYER_COLORS: Record<string, string> = {
  red: "#e53935",
  yellow: "#f9a825",
};

export const PLAYER_HOME_BG: Record<string, string> = {
  red: "#ffcdd2",
  yellow: "#fff9c4",
};
