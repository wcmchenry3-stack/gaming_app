import React from "react";
import { render, fireEvent, act, screen, waitFor } from "@testing-library/react-native";
import BlackjackTableScreen from "../BlackjackTableScreen";
import { BlackjackGameProvider } from "../../game/blackjack/BlackjackGameContext";
import { ThemeProvider } from "../../theme/ThemeContext";
import { loadGame } from "../../game/blackjack/storage";
import { newGame, placeBet, stand, EngineState } from "../../game/blackjack/engine";

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
  } as unknown as Parameters<typeof BlackjackTableScreen>[0]["navigation"];
}

/** Construct a player-phase state, retrying to avoid natural blackjack. */
function makePlayerPhaseState(): EngineState {
  for (let i = 0; i < 50; i++) {
    const s = placeBet(newGame(), 100);
    if (s.phase === "player") return s;
  }
  throw new Error("Could not reach player phase in 50 attempts");
}

/** Construct a result-phase state via stand after player phase. */
function makeResultPhaseState(): EngineState {
  const s = makePlayerPhaseState();
  return stand(s);
}

function renderScreen(nav = mockNav()) {
  return render(
    <ThemeProvider>
      <BlackjackGameProvider>
        <BlackjackTableScreen navigation={nav} />
      </BlackjackGameProvider>
    </ThemeProvider>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Auto-redirect to BettingScreen when phase is betting
// ---------------------------------------------------------------------------

describe("BlackjackTableScreen — phase redirect", () => {
  it("calls navigation.replace('BlackjackBetting') when loaded in betting phase (default)", async () => {
    // Default loadGame returns null → newGame() → betting phase
    const nav = mockNav();
    renderScreen(nav);
    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("BlackjackBetting");
    });
  });
});

// ---------------------------------------------------------------------------
// Player phase
// ---------------------------------------------------------------------------

describe("BlackjackTableScreen — player phase", () => {
  beforeEach(() => {
    (loadGame as jest.Mock).mockResolvedValue(makePlayerPhaseState());
  });

  it("shows Hit and Stand buttons", async () => {
    renderScreen();
    await screen.findByText("Hit");
    expect(screen.getByText("Stand")).toBeTruthy();
  });

  it("back button calls goBack()", async () => {
    const nav = mockNav();
    renderScreen(nav);
    await screen.findByText("Hit");
    fireEvent.press(screen.getByLabelText(/back/i));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it("chip balance is visible during player phase", async () => {
    renderScreen();
    await screen.findByText("Hit");
    await waitFor(() => {
      expect(screen.queryByLabelText(/bankroll: \d+ chips/i)).toBeTruthy();
    });
  });

  it("Hit button stays in player/result phase (Deal button absent)", async () => {
    renderScreen();
    await screen.findByText("Hit");
    await act(async () => {
      fireEvent.press(screen.getByText("Hit"));
    });
    await waitFor(() => {
      const hit = screen.queryByText("Hit");
      const nextHand = screen.queryByText("Next Hand");
      expect(hit || nextHand).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// Result phase
// ---------------------------------------------------------------------------

describe("BlackjackTableScreen — result phase", () => {
  beforeEach(() => {
    (loadGame as jest.Mock).mockResolvedValue(makeResultPhaseState());
  });

  it("shows Next Hand and Quit buttons in result phase", async () => {
    renderScreen();
    await screen.findByText("Next Hand");
    expect(screen.getByText("Quit")).toBeTruthy();
  });

  it("chip balance is visible during result phase", async () => {
    renderScreen();
    await screen.findByText("Next Hand");
    expect(screen.queryByLabelText(/bankroll: \d+ chips/i)).toBeTruthy();
  });

  it("Quit button calls goBack()", async () => {
    const nav = mockNav();
    renderScreen(nav);
    await screen.findByText("Next Hand");
    fireEvent.press(screen.getByLabelText(/quit/i));
    expect(nav.goBack).toHaveBeenCalled();
  });

  it("Next Hand calls navigation.replace('BlackjackBetting') via phase change", async () => {
    const nav = mockNav();
    renderScreen(nav);
    const nextHandBtn = await screen.findByText("Next Hand", {}, { timeout: 5000 });
    await act(async () => {
      fireEvent.press(nextHandBtn);
    });
    await waitFor(() => {
      expect(nav.replace).toHaveBeenCalledWith("BlackjackBetting");
    });
  });
});

// ---------------------------------------------------------------------------
// GH #226 — Persistent table layout
// ---------------------------------------------------------------------------

describe("BlackjackTableScreen — persistent table layout (GH #226)", () => {
  it("table labels visible during player phase", async () => {
    (loadGame as jest.Mock).mockResolvedValue(makePlayerPhaseState());
    renderScreen();
    await screen.findByText("Hit");
    expect(screen.getByText("Dealer's Hand")).toBeTruthy();
    expect(screen.getByText("Your Hand")).toBeTruthy();
  });
});

// Game-over modal (visible when chips=0 && phase=result) is covered by the
// blackjack-errors.spec.ts e2e suite; Modal does not render its children
// reliably in the RNTL test environment.
