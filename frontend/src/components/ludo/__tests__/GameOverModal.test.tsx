import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import LudoGameOverModal from "../GameOverModal";
import { ThemeProvider } from "../../../theme/ThemeContext";

function renderModal(
  winner: string | null,
  visible = true,
  onPlayAgain = jest.fn(),
  onHome = jest.fn()
) {
  return render(
    <ThemeProvider>
      <LudoGameOverModal
        visible={visible}
        winner={winner}
        humanPlayer="red"
        onPlayAgain={onPlayAgain}
        onHome={onHome}
      />
    </ThemeProvider>
  );
}

describe("LudoGameOverModal", () => {
  it('shows "You Win!" when human player wins', () => {
    const { getByText } = renderModal("red");
    expect(getByText("You Win!")).toBeTruthy();
  });

  it('shows "CPU Wins!" when cpu wins', () => {
    const { getByText } = renderModal("yellow");
    expect(getByText("CPU Wins!")).toBeTruthy();
  });

  it("renders Play Again and Home buttons", () => {
    const { getByText } = renderModal("red");
    expect(getByText("Play Again")).toBeTruthy();
    expect(getByText("Home")).toBeTruthy();
  });

  it("calls onPlayAgain when Play Again pressed", () => {
    const onPlayAgain = jest.fn();
    const { getByText } = renderModal("red", true, onPlayAgain);
    fireEvent.press(getByText("Play Again"));
    expect(onPlayAgain).toHaveBeenCalled();
  });

  it("calls onHome when Home pressed", () => {
    const onHome = jest.fn();
    const { getByText } = renderModal("red", true, jest.fn(), onHome);
    fireEvent.press(getByText("Home"));
    expect(onHome).toHaveBeenCalled();
  });
});
