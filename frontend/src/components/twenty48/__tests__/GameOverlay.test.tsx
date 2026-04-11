import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import GameOverlay from "../GameOverlay";
import { ThemeProvider } from "../../../theme/ThemeContext";

function renderOverlay(
  type: "game_over" | "win",
  overrides: Partial<React.ComponentProps<typeof GameOverlay>> = {}
) {
  const props = {
    type,
    score: 1024,
    onNewGame: jest.fn(),
    onHome: jest.fn(),
    ...overrides,
  };
  return render(
    <ThemeProvider>
      <GameOverlay {...props} />
    </ThemeProvider>
  );
}

describe("GameOverlay — game over state", () => {
  it('shows "Game Over" title', () => {
    const { getByText } = renderOverlay("game_over");
    expect(getByText("Game Over")).toBeTruthy();
  });

  it("does not show keep playing button", () => {
    const { queryByText } = renderOverlay("game_over");
    expect(queryByText("Keep Playing")).toBeNull();
  });

  it('calls onNewGame when "New Game" is pressed', () => {
    const onNewGame = jest.fn();
    const { getByLabelText } = renderOverlay("game_over", { onNewGame });
    fireEvent.press(getByLabelText("Start a new 2048 game"));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it('calls onHome when "Home" is pressed', () => {
    const onHome = jest.fn();
    const { getByLabelText } = renderOverlay("game_over", { onHome });
    fireEvent.press(getByLabelText("Quit and return to home screen"));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("renders the score callout with correct accessibility label", () => {
    const { getByLabelText } = renderOverlay("game_over", { score: 512 });
    expect(getByLabelText("Current score: 512")).toBeTruthy();
  });
});

describe("GameOverlay — win state", () => {
  it('shows "You Win!" title', () => {
    const { getByText } = renderOverlay("win");
    expect(getByText("You Win!")).toBeTruthy();
  });

  it("shows keep playing button when onKeepPlaying is provided", () => {
    const { getByLabelText } = renderOverlay("win", { onKeepPlaying: jest.fn() });
    expect(getByLabelText("Continue playing after reaching 2048")).toBeTruthy();
  });

  it("calls onKeepPlaying when button is pressed", () => {
    const onKeepPlaying = jest.fn();
    const { getByLabelText } = renderOverlay("win", { onKeepPlaying });
    fireEvent.press(getByLabelText("Continue playing after reaching 2048"));
    expect(onKeepPlaying).toHaveBeenCalledTimes(1);
  });

  it("calls onNewGame when New Game is pressed from win state", () => {
    const onNewGame = jest.fn();
    const { getByLabelText } = renderOverlay("win", { onNewGame, onKeepPlaying: jest.fn() });
    fireEvent.press(getByLabelText("Start a new 2048 game"));
    expect(onNewGame).toHaveBeenCalledTimes(1);
  });

  it("does not show keep playing button when onKeepPlaying is not provided", () => {
    const { queryByLabelText } = renderOverlay("win");
    expect(queryByLabelText("Continue playing after reaching 2048")).toBeNull();
  });

  it("renders the score callout with correct accessibility label", () => {
    const { getByLabelText } = renderOverlay("win", { score: 2048 });
    expect(getByLabelText("Current score: 2048")).toBeTruthy();
  });
});
