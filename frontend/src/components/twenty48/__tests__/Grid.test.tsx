import React from "react";
import { render } from "@testing-library/react-native";
import Grid from "../Grid";
import { ThemeProvider } from "../../../theme/ThemeContext";

const EMPTY_BOARD = Array.from({ length: 4 }, () => Array(4).fill(0));

function renderGrid(board = EMPTY_BOARD) {
  return render(
    <ThemeProvider>
      <Grid board={board} />
    </ThemeProvider>
  );
}

describe("Grid", () => {
  it("renders 16 cells for a 4×4 board", () => {
    const { getAllByLabelText } = renderGrid();
    // Each zero cell has accessibilityLabel "empty"
    expect(getAllByLabelText("empty")).toHaveLength(16);
  });

  it("renders tiles for non-zero values", () => {
    const board = EMPTY_BOARD.map((row) => [...row]);
    board[0][0] = 2;
    board[1][2] = 512;
    const { getByText } = renderGrid(board);
    expect(getByText("2")).toBeTruthy();
    expect(getByText("512")).toBeTruthy();
  });

  it("does not render text for empty (zero) cells", () => {
    const { queryByText } = renderGrid();
    expect(queryByText("0")).toBeNull();
  });

  it("has accessibilityLabel 'Game board' on the container", () => {
    const { getByLabelText } = renderGrid();
    expect(getByLabelText("Game board")).toBeTruthy();
  });

  it("renders the correct count of non-zero tiles", () => {
    const board = EMPTY_BOARD.map((row) => [...row]);
    board[0][0] = 2;
    board[2][3] = 4;
    board[3][1] = 8;
    const { getAllByLabelText } = renderGrid(board);
    expect(getAllByLabelText("empty")).toHaveLength(13);
    expect(getAllByLabelText("2")).toHaveLength(1);
    expect(getAllByLabelText("4")).toHaveLength(1);
    expect(getAllByLabelText("8")).toHaveLength(1);
  });
});
