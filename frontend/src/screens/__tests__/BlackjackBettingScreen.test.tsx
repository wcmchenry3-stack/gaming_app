import React from "react";
import { render, fireEvent, act, screen, waitFor } from "@testing-library/react-native";
import BlackjackBettingScreen from "../BlackjackBettingScreen";
import { BlackjackGameProvider } from "../../game/blackjack/BlackjackGameContext";
import { ThemeProvider } from "../../theme/ThemeContext";
import { loadGame } from "../../game/blackjack/storage";
import { newGame } from "../../game/blackjack/engine";
import { EngineState } from "../../game/blackjack/engine";

// ---------------------------------------------------------------------------
// Mock blackjack storage — no saved game by default, no-op persistence.
// ---------------------------------------------------------------------------
jest.mock("../../game/blackjack/storage", () => ({
  saveGame: jest.fn(),
  clearGame: jest.fn(),
  loadGame: jest.fn().mockResolvedValue(null),
}));

function mockNav() {
  return {
    navigate: jest.fn(),
    goBack: jest.fn(),
    replace: jest.fn(),
  } as unknown as Parameters<typeof BlackjackBettingScreen>[0]["navigation"];
}

function renderScreen(nav = mockNav()) {
  return render(
    <ThemeProvider>
      <BlackjackGameProvider>
        <BlackjackBettingScreen navigation={nav} />
      </BlackjackGameProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Initial load
// ---------------------------------------------------------------------------

describe("BlackjackBettingScreen — initial load", () => {
  it("renders BettingPanel after mount (no saved game)", async () => {
    renderScreen();
    expect(await screen.findByText("Deal")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Header / navigation
// ---------------------------------------------------------------------------

describe("BlackjackBettingScreen — header / navigation", () => {
  it("back button calls navigation.goBack", async () => {
    const nav = mockNav();
    renderScreen(nav);
    await screen.findByText("Deal");
    fireEvent.press(screen.getByLabelText(/back/i));
    expect(nav.goBack).toHaveBeenCalledTimes(1);
  });

  it("shows Blackjack title", async () => {
    renderScreen();
    await waitFor(() => expect(screen.getByText("Blackjack")).toBeTruthy());
  });
});

// ---------------------------------------------------------------------------
// Auto-redirect when phase is not betting (e.g. app restart mid-hand)
// ---------------------------------------------------------------------------

describe("BlackjackBettingScreen — phase redirect", () => {
  it("calls navigation.replace('BlackjackTable') when loaded in player phase", async () => {
    const playerState: EngineState = { ...newGame(), phase: "player", bet: 100 };
    (loadGame as jest.Mock).mockResolvedValueOnce(playerState);
    const nav = mockNav();
    renderScreen(nav);
    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("BlackjackTable");
    });
  });

  it("calls navigation.replace('BlackjackTable') when loaded in result phase", async () => {
    const resultState: EngineState = {
      ...newGame(),
      phase: "result",
      bet: 100,
      outcome: "win",
    };
    (loadGame as jest.Mock).mockResolvedValueOnce(resultState);
    const nav = mockNav();
    renderScreen(nav);
    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("BlackjackTable");
    });
  });

  it("calls navigation.replace('BlackjackTable') after Deal transitions phase", async () => {
    const nav = mockNav();
    renderScreen(nav);
    const dealBtn = await screen.findByText("Deal");
    await act(async () => {
      fireEvent.press(dealBtn);
    });
    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("BlackjackTable");
    });
  });
});

// ---------------------------------------------------------------------------
// GH #227 — Chip balance visible during betting phase
// ---------------------------------------------------------------------------

describe("BlackjackBettingScreen — chip balance visibility (GH #227)", () => {
  it("chip balance is visible in BettingPanel during betting phase", async () => {
    renderScreen();
    await screen.findByText("Deal");
    expect(screen.getByLabelText(/you have 1000 chips/i)).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// GH #226 — Persistent table layout visible during betting phase
// ---------------------------------------------------------------------------

describe("BlackjackBettingScreen — persistent table layout (GH #226)", () => {
  it("Dealer's Hand and Your Hand labels are visible during betting phase", async () => {
    renderScreen();
    await screen.findByText("Deal");
    expect(screen.getByText("Dealer's Hand")).toBeTruthy();
    expect(screen.getByText("Your Hand")).toBeTruthy();
  });
});
