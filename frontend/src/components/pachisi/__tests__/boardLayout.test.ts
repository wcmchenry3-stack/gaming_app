import {
  TRACK_INDEX_TO_CELL,
  CELL_ROLES,
  SAFE_TRACK_INDICES,
  HOME_BASE_CELLS,
  PLAYER_COLORS,
} from "../boardLayout";

describe("TRACK_INDEX_TO_CELL", () => {
  it("has exactly 52 outer track entries (0-51)", () => {
    const outerEntries = Object.keys(TRACK_INDEX_TO_CELL)
      .map(Number)
      .filter((k) => k >= 0 && k <= 51);
    expect(outerEntries).toHaveLength(52);
  });

  it("maps Red entry (0) to a cell in the left arm area", () => {
    const [row, col] = TRACK_INDEX_TO_CELL[0];
    expect(row).toBe(6);
    expect(col).toBe(1);
  });

  it("maps Yellow entry (26) to a cell in the right arm area", () => {
    const [row, col] = TRACK_INDEX_TO_CELL[26];
    expect(row).toBe(8);
    expect(col).toBe(13);
  });

  it("maps FINISH (100) to the center cell [7,7]", () => {
    expect(TRACK_INDEX_TO_CELL[100]).toEqual([7, 7]);
  });

  it("all 52 outer track positions map to distinct cells", () => {
    const cells = new Set<string>();
    for (let i = 0; i < 52; i++) {
      const cell = TRACK_INDEX_TO_CELL[i];
      expect(cell).toBeDefined();
      cells.add(`${cell[0]},${cell[1]}`);
    }
    expect(cells.size).toBe(52);
  });

  it("maps Red home col start (52) inside the top arm", () => {
    const [row, col] = TRACK_INDEX_TO_CELL[52];
    expect(col).toBe(7); // middle col of top arm
    expect(row).toBeGreaterThanOrEqual(1);
    expect(row).toBeLessThanOrEqual(5);
  });

  it("maps Yellow home col start (64) inside the right arm", () => {
    const [row, col] = TRACK_INDEX_TO_CELL[64];
    expect(row).toBe(7); // middle row of right arm
    expect(col).toBeGreaterThanOrEqual(9);
    expect(col).toBeLessThanOrEqual(13);
  });

  it("has 5 home col entries for Red (52-56)", () => {
    for (let i = 52; i <= 56; i++) {
      expect(TRACK_INDEX_TO_CELL[i]).toBeDefined();
    }
  });

  it("has 5 home col entries for Yellow (64-68)", () => {
    for (let i = 64; i <= 68; i++) {
      expect(TRACK_INDEX_TO_CELL[i]).toBeDefined();
    }
  });
});

describe("CELL_ROLES", () => {
  it("covers all 225 cells of the 15×15 grid", () => {
    let count = 0;
    for (let r = 0; r < 15; r++) {
      for (let c = 0; c < 15; c++) {
        if (CELL_ROLES[`${r},${c}`]) count++;
      }
    }
    expect(count).toBe(225);
  });

  it("marks Red home base cells correctly", () => {
    expect(CELL_ROLES["0,0"]).toBe("home_base_red");
    expect(CELL_ROLES["5,5"]).toBe("home_base_red");
  });

  it("marks Yellow home base cells correctly", () => {
    expect(CELL_ROLES["9,9"]).toBe("home_base_yellow");
    expect(CELL_ROLES["14,14"]).toBe("home_base_yellow");
  });

  it("marks center cell as center", () => {
    expect(CELL_ROLES["7,7"]).toBe("center");
  });

  it("marks safe track indices correctly", () => {
    // Position 0 = [6,1] = safe
    expect(CELL_ROLES["6,1"]).toBe("safe");
    // Position 26 = [8,13] = safe (Yellow entry)
    expect(CELL_ROLES["8,13"]).toBe("safe");
  });

  it("marks Red home col cells correctly", () => {
    // Red home col: col 7, rows 1-5
    for (let r = 1; r <= 5; r++) {
      expect(CELL_ROLES[`${r},7`]).toBe("home_col_red");
    }
  });

  it("marks Yellow home col cells correctly", () => {
    // Yellow home col: row 7, cols 9-13
    for (let c = 9; c <= 13; c++) {
      expect(CELL_ROLES[`7,${c}`]).toBe("home_col_yellow");
    }
  });
});

describe("SAFE_TRACK_INDICES", () => {
  it("has exactly 8 safe squares", () => {
    expect(SAFE_TRACK_INDICES.size).toBe(8);
  });

  it("includes Red entry (0) and Yellow entry (26)", () => {
    expect(SAFE_TRACK_INDICES.has(0)).toBe(true);
    expect(SAFE_TRACK_INDICES.has(26)).toBe(true);
  });
});

describe("HOME_BASE_CELLS", () => {
  it("has 4 spawn slots for Red and Yellow", () => {
    expect(HOME_BASE_CELLS.red).toHaveLength(4);
    expect(HOME_BASE_CELLS.yellow).toHaveLength(4);
  });

  it("Red spawn slots are within Red home base (rows 0-5, cols 0-5)", () => {
    for (const [r, c] of HOME_BASE_CELLS.red) {
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThanOrEqual(5);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(5);
    }
  });

  it("Yellow spawn slots are within Yellow home base (rows 9-14, cols 9-14)", () => {
    for (const [r, c] of HOME_BASE_CELLS.yellow) {
      expect(r).toBeGreaterThanOrEqual(9);
      expect(r).toBeLessThanOrEqual(14);
      expect(c).toBeGreaterThanOrEqual(9);
      expect(c).toBeLessThanOrEqual(14);
    }
  });
});

describe("PLAYER_COLORS", () => {
  it("defines colors for red and yellow", () => {
    expect(PLAYER_COLORS.red).toBeTruthy();
    expect(PLAYER_COLORS.yellow).toBeTruthy();
  });
});
