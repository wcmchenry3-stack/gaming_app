/**
 * Tests for GameOverOverlay — covers the submit/error/saved/restart branches
 * that account for the low coverage on this component.
 *
 * Uses @testing-library/react-native for render + interaction.
 */

import React from "react";
import { render, fireEvent, waitFor, screen } from "@testing-library/react-native";
import GameOverOverlay from "../GameOverOverlay";
import { fruitMergeApi } from "../../../api/fruitMergeClient";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock("../../../api/fruitMergeClient", () => ({
  fruitMergeApi: {
    submitScore: jest.fn(),
  },
}));

// ThemeContext reads from AsyncStorage on native; provide a minimal stub
jest.mock("../../../theme/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      text: "#fff",
      textMuted: "#aaa",
      accent: "#3b82f6",
      surface: "#1e293b",
      border: "#334155",
      error: "#ef4444",
      bonus: "#22c55e",
      modalBg: "#0f172a",
    },
    theme: "dark",
    toggle: jest.fn(),
  }),
}));

const mockSubmitScore = fruitMergeApi.submitScore as jest.Mock;

function renderOverlay(score = 1234, onRestart = jest.fn()) {
  return render(<GameOverOverlay score={score} onRestart={onRestart} />);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GameOverOverlay", () => {
  beforeEach(() => {
    mockSubmitScore.mockReset();
  });

  it("renders score and Game Over heading", () => {
    renderOverlay(5678);
    expect(screen.getByText("Game Over")).toBeTruthy();
    expect(screen.getByText("5,678")).toBeTruthy();
  });

  it("pressing save with no name does not call the API", () => {
    renderOverlay();
    fireEvent.press(screen.getByLabelText("Save score"));
    expect(mockSubmitScore).not.toHaveBeenCalled();
  });

  it("pressing save after entering a name calls the API", async () => {
    mockSubmitScore.mockResolvedValueOnce({ name: "Alice", score: 1234, rank: 1 });
    renderOverlay(1234);
    fireEvent.changeText(screen.getByLabelText("Your name"), "Alice");
    fireEvent.press(screen.getByLabelText("Save score"));
    await waitFor(() => expect(mockSubmitScore).toHaveBeenCalledWith("Alice", 1234));
  });

  it("shows saved confirmation after successful submit", async () => {
    mockSubmitScore.mockResolvedValueOnce({ name: "Alice", score: 1234, rank: 2 });
    renderOverlay(1234);

    fireEvent.changeText(screen.getByLabelText("Your name"), "Alice");
    fireEvent.press(screen.getByLabelText("Save score"));

    await waitFor(() => {
      expect(screen.getByText(/Saved!/i)).toBeTruthy();
    });
    expect(mockSubmitScore).toHaveBeenCalledWith("Alice", 1234);
  });

  it("shows error message when submit fails", async () => {
    mockSubmitScore.mockRejectedValueOnce(new Error("Network error"));
    renderOverlay(1234);

    fireEvent.changeText(screen.getByLabelText("Your name"), "Bob");
    fireEvent.press(screen.getByLabelText("Save score"));

    await waitFor(() => {
      expect(screen.getByText(/Could not save score/i)).toBeTruthy();
    });
  });

  it("calls onRestart when Play Again is pressed", () => {
    const onRestart = jest.fn();
    renderOverlay(100, onRestart);
    fireEvent.press(screen.getByLabelText("Play again"));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });
});
