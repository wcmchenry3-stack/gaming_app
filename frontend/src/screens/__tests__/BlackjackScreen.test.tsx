import React from "react";
import { render, fireEvent, act, screen, waitFor } from "@testing-library/react-native";
import BlackjackScreen from "../BlackjackScreen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { loadGame } from "../../game/blackjack/storage";
import { newGame, placeBet, stand } from "../../game/blackjack/engine";

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

// ---------------------------------------------------------------------------
// GH #227 — Chip balance visible during player and result phases
// ---------------------------------------------------------------------------

describe("BlackjackScreen — chip balance visibility (GH #227)", () => {
  it("chip balance is visible in BettingPanel during betting phase", async () => {
    renderScreen();
    await screen.findByText("Deal");
    // BettingPanel renders "1000 chips" during betting
    expect(screen.getByLabelText(/you have 1000 chips/i)).toBeTruthy();
  });

  it("chip balance remains visible after dealing (player phase)", async () => {
    renderScreen();
    await screen.findByText("Deal");
    await act(async () => {
      fireEvent.press(screen.getByText("Deal"));
    });
    // After deal, either player or result phase — chips strip should be visible
    await waitFor(() => {
      expect(screen.queryByLabelText(/you have \d+ chips/i)).toBeTruthy();
    });
  });
});

// ---------------------------------------------------------------------------
// GH #226 — Persistent table layout — table visible during betting phase
// ---------------------------------------------------------------------------

describe("BlackjackScreen — persistent table layout (GH #226)", () => {
  it("Dealer's Hand label is visible during the betting phase", async () => {
    renderScreen();
    await screen.findByText("Deal");
    // Table is now always rendered; hand labels should be visible even pre-deal
    expect(screen.getByText("Dealer's Hand")).toBeTruthy();
    expect(screen.getByText("Your Hand")).toBeTruthy();
  });

  it("table labels remain visible after transitioning back to betting via Next Hand", async () => {
    // Inject a result-phase state so we can press Next Hand
    const resultState = (() => {
      // Build a deterministic ended hand: deal, stand, which lands in result
      let s = newGame();
      s = placeBet(s, 100);
      // Stand immediately (dealer will draw; eventually result phase)
      s = stand(s);
      return s;
    })();
    (loadGame as jest.Mock).mockResolvedValueOnce(resultState);

    renderScreen();

    // Wait until Next Hand button appears (result phase)
    const nextHandBtn = await screen.findByText("Next Hand", {}, { timeout: 5000 });
    await act(async () => {
      fireEvent.press(nextHandBtn);
    });

    // Back in betting phase — table should still show hand labels
    await waitFor(() => {
      expect(screen.getByText("Deal")).toBeTruthy(); // BettingPanel visible
      expect(screen.getByText("Dealer's Hand")).toBeTruthy(); // Table still visible
    });
  });
});
