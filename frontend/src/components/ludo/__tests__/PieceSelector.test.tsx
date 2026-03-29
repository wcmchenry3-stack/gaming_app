import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import PieceSelector from "../PieceSelector";
import { ThemeProvider } from "../../../theme/ThemeContext";

function renderSelector(
  validMoves: number[],
  onSelect = jest.fn(),
  loading = false
) {
  return render(
    <ThemeProvider>
      <PieceSelector
        validMoves={validMoves}
        playerColor="red"
        onSelect={onSelect}
        loading={loading}
      />
    </ThemeProvider>
  );
}

describe("PieceSelector", () => {
  it("renders one button per valid move", () => {
    const { getAllByRole } = renderSelector([0, 2]);
    expect(getAllByRole("button")).toHaveLength(2);
  });

  it("renders correct label for each move index", () => {
    const { getByText } = renderSelector([0, 2]);
    expect(getByText("Move Piece 1")).toBeTruthy();
    expect(getByText("Move Piece 3")).toBeTruthy();
  });

  it("calls onSelect with the correct piece index when pressed", () => {
    const onSelect = jest.fn();
    const { getByText } = renderSelector([0, 2], onSelect);
    fireEvent.press(getByText("Move Piece 3"));
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it("does not call onSelect when loading", () => {
    const onSelect = jest.fn();
    const { getByText } = renderSelector([0], onSelect, true);
    fireEvent.press(getByText("Move Piece 1"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("renders nothing when validMoves is empty", () => {
    const { queryAllByRole } = renderSelector([]);
    expect(queryAllByRole("button")).toHaveLength(0);
  });
});
