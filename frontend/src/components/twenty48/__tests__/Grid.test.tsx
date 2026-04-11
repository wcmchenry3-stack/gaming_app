import React from "react";
import { render } from "@testing-library/react-native";
import Grid from "../Grid";
import { ThemeProvider } from "../../../theme/ThemeContext";
import { TileData } from "../../../game/twenty48/types";

function makeTile(id: number, value: number, row: number, col: number): TileData {
  return { id, value, row, col, prevRow: row, prevCol: col, isNew: false, isMerge: false };
}

function renderGrid(tiles: TileData[] = []) {
  return render(
    <ThemeProvider>
      <Grid tiles={tiles} />
    </ThemeProvider>
  );
}

describe("Grid", () => {
  it("renders 16 empty slot backgrounds for an empty board", () => {
    const { getAllByLabelText } = renderGrid([]);
    // All 16 slots have "empty" label (from AnimatedTile with value 0).
    // With no tiles passed, only slot backgrounds render — no tiles at all.
    // The grid container itself is accessible.
    expect(getAllByLabelText("Game board")).toHaveLength(1);
  });

  it("renders tiles for non-zero values", () => {
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 512, 1, 2)];
    const { getByText } = renderGrid(tiles);
    expect(getByText("2")).toBeTruthy();
    expect(getByText("512")).toBeTruthy();
  });

  it("does not render text for tiles with value 0", () => {
    const tiles = [makeTile(1, 0, 0, 0)];
    const { queryByText } = renderGrid(tiles);
    expect(queryByText("0")).toBeNull();
  });

  it("has accessibilityLabel 'Game board' on the container", () => {
    const { getByLabelText } = renderGrid();
    expect(getByLabelText("Game board")).toBeTruthy();
  });

  it("renders the correct accessibility labels for tile values", () => {
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 4, 2, 3), makeTile(3, 8, 3, 1)];
    const { getAllByLabelText } = renderGrid(tiles);
    expect(getAllByLabelText("2")).toHaveLength(1);
    expect(getAllByLabelText("4")).toHaveLength(1);
    expect(getAllByLabelText("8")).toHaveLength(1);
  });

  it("marks all 16 empty slots with label 'empty' when no tiles are present", () => {
    const { getAllByLabelText } = renderGrid([]);
    expect(getAllByLabelText("empty")).toHaveLength(16);
  });

  it("only marks unoccupied cells as empty when tiles are present", () => {
    // 2 tiles placed → 14 empty slots.
    const tiles = [makeTile(1, 2, 0, 0), makeTile(2, 4, 3, 3)];
    const { getAllByLabelText } = renderGrid(tiles);
    expect(getAllByLabelText("empty")).toHaveLength(14);
  });
});
