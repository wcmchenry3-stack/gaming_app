import React from "react";
import { render, fireEvent, act, screen, waitFor } from "@testing-library/react-native";
import BlackjackScreen from "../BlackjackScreen";
import { ThemeProvider } from "../../theme/ThemeContext";

// ---------------------------------------------------------------------------
// Mock blackjack storage — no saved game by default, no-op persistence.
// Engine runs live with real Math.random().
// ---------------------------------------------------------------------------
jest.mock("../../game/blackjack/storage", () => ({
  saveGame: jest.fn(),
  clearGame: jest.fn(),
  loadGame: jest.fn().mockResolvedValue(null),
}));

function mockNav() {
  return { navigate: jest.fn() } as unknown as Parameters<typeof BlackjackScreen>[0]["navigation"];
}

function renderScreen(nav = mockNav()) {
  return render(
    <ThemeProvider>
      <BlackjackScreen navigation={nav} />
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("BlackjackScreen — initial load", () => {
  it("renders BettingPanel after mount (no saved game)", async () => {
    renderScreen();
    expect(await screen.findByText("Deal")).toBeTruthy();
  });
});

describe("BlackjackScreen — betting → player", () => {
  it("pressing Deal transitions to player phase (or result on natural BJ)", async () => {
    renderScreen();
    const dealBtn = await screen.findByText("Deal");
    await act(async () => {
      fireEvent.press(dealBtn);
    });
    // After deal, we're either in player phase (Hit/Stand visible) or result
    // (Next Hand visible) if both hands were naturals. Either way, Deal is gone.
    await waitFor(() => {
      const hit = screen.queryByText("Hit");
      const nextHand = screen.queryByText("Next Hand");
      expect(hit || nextHand).toBeTruthy();
    });
  });
});

describe("BlackjackScreen — header / navigation", () => {
  it("back button navigates to Home", async () => {
    const nav = mockNav();
    renderScreen(nav);
    await screen.findByText("Deal"); // wait for mount
    const back = screen.getByLabelText(/back/i);
    fireEvent.press(back);
    expect(nav.navigate).toHaveBeenCalledWith("Home");
  });

  it("shows Blackjack title", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Blackjack")).toBeTruthy());
  });
});
