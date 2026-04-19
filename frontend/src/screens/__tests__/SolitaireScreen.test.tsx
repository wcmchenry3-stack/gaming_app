/**
 * SolitaireScreen (#596) — screen-level interaction tests.
 *
 * The engine itself is pure and well-tested (#593); these tests focus on
 * the screen's selection state machine, HUD wiring, modals, and the
 * plumbing between tap events and engine calls.
 */

import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";

import SolitaireScreen from "../SolitaireScreen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { createSeededRng, setRng } from "../../game/solitaire/engine";

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    popToTop: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn(),
  }),
}));

jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: jest.fn(),
  captureMessage: jest.fn(),
  captureException: jest.fn(),
  init: jest.fn(),
  wrap: <T,>(x: T) => x,
}));

function renderScreen() {
  return render(
    <ThemeProvider>
      <SolitaireScreen />
    </ThemeProvider>
  );
}

function chooseDraw1(api: ReturnType<typeof renderScreen>) {
  act(() => {
    fireEvent.press(api.getByLabelText("Draw 1"));
  });
}

beforeEach(() => {
  // Pin the seed-bank picker so every deal produces the same initial
  // tableau/foundations — test assertions can rely on specific counts.
  setRng(createSeededRng(42));
});

describe("SolitaireScreen — pre-game modal", () => {
  it("renders the draw-mode modal on mount", () => {
    const { getByLabelText, getByRole } = renderScreen();
    expect(getByRole("header")).toBeTruthy();
    expect(getByLabelText("Draw 1")).toBeTruthy();
    expect(getByLabelText("Draw 3")).toBeTruthy();
  });

  it("deals a game after choosing Draw 1", () => {
    const api = renderScreen();
    chooseDraw1(api);
    // HUD labels use interpolated strings — Score: 0 / Moves: 0 on fresh deal.
    expect(api.getByLabelText("Score: 0")).toBeTruthy();
    expect(api.getByLabelText("Moves: 0")).toBeTruthy();
  });

  it("deals a game after choosing Draw 3", () => {
    const api = renderScreen();
    act(() => {
      fireEvent.press(api.getByLabelText("Draw 3"));
    });
    expect(api.getByLabelText("Score: 0")).toBeTruthy();
  });
});

describe("SolitaireScreen — board layout", () => {
  it("renders 7 tableau columns with correct initial sizes", () => {
    const api = renderScreen();
    chooseDraw1(api);
    // Columns i=0..6 start with i+1 cards each.
    for (let i = 0; i < 7; i++) {
      expect(api.getByLabelText(`Tableau column ${i + 1}, ${i + 1} cards`)).toBeTruthy();
    }
  });

  it("renders 4 empty foundation placeholders (one per suit)", () => {
    const api = renderScreen();
    chooseDraw1(api);
    expect(api.getByLabelText("Empty Spades foundation")).toBeTruthy();
    expect(api.getByLabelText("Empty Hearts foundation")).toBeTruthy();
    expect(api.getByLabelText("Empty Diamonds foundation")).toBeTruthy();
    expect(api.getByLabelText("Empty Clubs foundation")).toBeTruthy();
  });

  it("shows the stock pile with 24 draw cards remaining", () => {
    const api = renderScreen();
    chooseDraw1(api);
    expect(api.getByLabelText("Draw 1 from stock, 24 cards remaining")).toBeTruthy();
  });
});

describe("SolitaireScreen — stock & waste", () => {
  it("tapping the stock draws a card onto the waste", () => {
    const api = renderScreen();
    chooseDraw1(api);
    act(() => {
      fireEvent.press(api.getByLabelText("Draw 1 from stock, 24 cards remaining"));
    });
    // 23 remain; waste has a visible (selectable) top card.
    expect(api.getByLabelText("Draw 1 from stock, 23 cards remaining")).toBeTruthy();
  });

  it("offers recycle when the stock is empty", () => {
    const api = renderScreen();
    chooseDraw1(api);
    // Drain the stock: 24 single draws.
    for (let i = 24; i > 0; i--) {
      act(() => {
        fireEvent.press(api.getByLabelText(`Draw 1 from stock, ${i} cards remaining`));
      });
    }
    expect(api.getByLabelText("Recycle waste back to stock (draw 1)")).toBeTruthy();
  });
});

describe("SolitaireScreen — undo affordance", () => {
  it("renders an Undo button in the header that is disabled on a fresh deal", () => {
    const api = renderScreen();
    chooseDraw1(api);
    const undo = api.getByLabelText("Undo");
    expect(undo.props.accessibilityState?.disabled).toBe(true);
  });

  it("enables Undo after a stock draw and reverts the draw on press", () => {
    const api = renderScreen();
    chooseDraw1(api);
    act(() => {
      fireEvent.press(api.getByLabelText("Draw 1 from stock, 24 cards remaining"));
    });
    const undo = api.getByLabelText("Undo");
    expect(undo.props.accessibilityState?.disabled).toBe(false);
    act(() => {
      fireEvent.press(undo);
    });
    expect(api.getByLabelText("Draw 1 from stock, 24 cards remaining")).toBeTruthy();
  });
});

describe("SolitaireScreen — auto-complete", () => {
  it("does not render the auto-complete button on a fresh deal (face-down cards exist)", () => {
    const api = renderScreen();
    chooseDraw1(api);
    expect(api.queryByLabelText("Auto-Complete")).toBeNull();
  });
});

describe("SolitaireScreen — new game confirmation", () => {
  it("returns to the pre-game modal without confirmation when score is 0", () => {
    const api = renderScreen();
    chooseDraw1(api);
    act(() => {
      fireEvent.press(api.getByLabelText("New Game"));
    });
    // Draw-mode modal is back.
    expect(api.getByLabelText("Draw 1")).toBeTruthy();
  });
});
