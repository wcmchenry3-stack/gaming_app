import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../../../theme/ThemeContext";
import PlayingCard from "../PlayingCard";
import PlayerHand from "../PlayerHand";
import OpponentHand from "../OpponentHand";
import TrickArea from "../TrickArea";
import ScoreBoard from "../ScoreBoard";
import PassBanner from "../PassBanner";
import type { Card, TrickCard } from "../../../game/hearts/types";

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

function c(suit: Card["suit"], rank: Card["rank"]): Card {
  return { suit, rank };
}

// ---------------------------------------------------------------------------
// PlayingCard
// ---------------------------------------------------------------------------

describe("PlayingCard", () => {
  it("renders rank and suit symbol for a visible card", () => {
    const { getByText } = wrap(<PlayingCard card={c("spades", 12)} />);
    expect(getByText("Q")).toBeTruthy();
    expect(getByText("♠")).toBeTruthy();
  });

  it("renders Ace as A", () => {
    const { getByText } = wrap(<PlayingCard card={c("hearts", 1)} />);
    expect(getByText("A")).toBeTruthy();
  });

  it("renders Jack, Queen, King correctly", () => {
    const { getByText: g1 } = wrap(<PlayingCard card={c("clubs", 11)} />);
    expect(g1("J")).toBeTruthy();
    const { getByText: g2 } = wrap(<PlayingCard card={c("diamonds", 13)} />);
    expect(g2("K")).toBeTruthy();
  });

  it("renders face-down card without rank/suit text", () => {
    const { queryByText } = wrap(<PlayingCard card={c("spades", 1)} faceDown />);
    expect(queryByText("A")).toBeNull();
    expect(queryByText("♠")).toBeNull();
  });

  it("has accessible label for visible card", () => {
    const { getByLabelText } = wrap(<PlayingCard card={c("hearts", 1)} />);
    expect(getByLabelText(/A.*Hearts/i)).toBeTruthy();
  });

  it("calls onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByRole } = wrap(<PlayingCard card={c("clubs", 7)} onPress={onPress} />);
    fireEvent.press(getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not call onPress when disabled", () => {
    const onPress = jest.fn();
    const { getByRole } = wrap(<PlayingCard card={c("clubs", 7)} onPress={onPress} disabled />);
    fireEvent.press(getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("disabled card wrapper is fully opaque (no opacity < 1)", () => {
    // Regression guard for #704: wrapper opacity makes the SVG translucent
    // and overlapping cards bleed through. Dimming must use an overlay.
    const { getByRole } = wrap(<PlayingCard card={c("clubs", 7)} onPress={() => {}} disabled />);
    const style = getByRole("button").props.style;
    const flat = Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean)) : style;
    expect(flat.opacity).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PlayerHand
// ---------------------------------------------------------------------------

describe("PlayerHand", () => {
  const hand: Card[] = [c("spades", 2), c("hearts", 5), c("clubs", 9)];

  it("renders all cards", () => {
    const { getByText } = wrap(<PlayerHand hand={hand} />);
    expect(getByText("2")).toBeTruthy();
    expect(getByText("5")).toBeTruthy();
    expect(getByText("9")).toBeTruthy();
  });

  it("renders empty hand without error", () => {
    const { toJSON } = wrap(<PlayerHand hand={[]} />);
    expect(toJSON()).toBeTruthy();
  });

  it("fires onCardPress with the correct card", () => {
    const onPress = jest.fn();
    // Hand is sorted: clubs 9, spades 2, hearts 5 → suit order clubs→spades→hearts
    // Sorted: clubs-9, spades-2, hearts-5 → buttons[0]=clubs9, [1]=spades2, [2]=hearts5
    const { getAllByRole } = wrap(<PlayerHand hand={hand} onCardPress={onPress} />);
    fireEvent.press(getAllByRole("button")[0]!);
    expect(onPress).toHaveBeenCalledWith(c("clubs", 9));
  });

  it("sorts by suit then rank ascending (clubs→diamonds→spades→hearts, Ace high)", () => {
    const unsorted: Card[] = [
      c("hearts", 1),
      c("clubs", 3),
      c("spades", 7),
      c("diamonds", 2),
      c("clubs", 1),
    ];
    const { getAllByRole } = wrap(<PlayerHand hand={unsorted} onCardPress={jest.fn()} />);
    const buttons = getAllByRole("button");
    // Expected sort: clubs-3, clubs-A, diamonds-2, spades-7, hearts-A
    expect(buttons[0]!.props.accessibilityLabel).toMatch(/3.*clubs/i);
    expect(buttons[1]!.props.accessibilityLabel).toMatch(/A.*clubs/i);
    expect(buttons[2]!.props.accessibilityLabel).toMatch(/2.*diamonds/i);
    expect(buttons[3]!.props.accessibilityLabel).toMatch(/7.*spades/i);
    expect(buttons[4]!.props.accessibilityLabel).toMatch(/A.*hearts/i);
  });
});

// ---------------------------------------------------------------------------
// OpponentHand
// ---------------------------------------------------------------------------

describe("OpponentHand", () => {
  it("renders correct number of face-down cards", () => {
    const { getAllByLabelText } = wrap(<OpponentHand cardCount={4} label="Left" />);
    expect(getAllByLabelText(/face.down/i)).toHaveLength(4);
  });

  it("renders label text", () => {
    const { getByText } = wrap(<OpponentHand cardCount={3} label="Right" />);
    expect(getByText("Right")).toBeTruthy();
  });

  it("renders zero cards without error", () => {
    const { toJSON } = wrap(<OpponentHand cardCount={0} label="Top" />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders score when provided", () => {
    const { getByText } = wrap(<OpponentHand cardCount={3} label="Top" score={12} />);
    expect(getByText("12")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// TrickArea
// ---------------------------------------------------------------------------

describe("TrickArea", () => {
  it("renders empty area when trick is empty", () => {
    const { toJSON } = wrap(<TrickArea trick={[]} playerIndex={0} />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders cards from the trick", () => {
    const trick: TrickCard[] = [
      { card: c("spades", 10), playerIndex: 0 },
      { card: c("hearts", 3), playerIndex: 1 },
    ];
    const { getByText } = wrap(
      <TrickArea trick={trick} playerIndex={0} playerLabels={["You", "Left", "Top", "Right"]} />
    );
    expect(getByText("10")).toBeTruthy();
    expect(getByText("3")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// ScoreBoard
// ---------------------------------------------------------------------------

describe("ScoreBoard", () => {
  const labels = ["You", "Left", "Top", "Right"];
  const cumulative = [10, 5, 20, 0];
  const history = [
    [3, 2, 8, 0],
    [7, 3, 12, 0],
  ];

  it("renders all player labels", () => {
    const { getByText } = wrap(
      <ScoreBoard playerLabels={labels} cumulativeScores={cumulative} scoreHistory={history} />
    );
    labels.forEach((l) => expect(getByText(l.slice(0, 5))).toBeTruthy());
  });

  it("renders cumulative totals row", () => {
    const { getByText } = wrap(
      <ScoreBoard playerLabels={labels} cumulativeScores={cumulative} scoreHistory={history} />
    );
    expect(getByText("20")).toBeTruthy();
  });

  it("renders per-round scores", () => {
    const { getAllByText } = wrap(
      <ScoreBoard playerLabels={labels} cumulativeScores={cumulative} scoreHistory={history} />
    );
    expect(getAllByText("3").length).toBeGreaterThan(0);
    expect(getAllByText("12").length).toBeGreaterThan(0);
  });

  it("renders empty history without error", () => {
    const { toJSON } = wrap(
      <ScoreBoard playerLabels={labels} cumulativeScores={[0, 0, 0, 0]} scoreHistory={[]} />
    );
    expect(toJSON()).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PassBanner
// ---------------------------------------------------------------------------

describe("PassBanner", () => {
  it("renders instructions with direction", () => {
    const { getByText } = wrap(
      <PassBanner passDirection="left" selectedCount={0} onConfirm={jest.fn()} />
    );
    expect(getByText(/pass left/i)).toBeTruthy();
  });

  it("shows 'X of 3 selected' counter", () => {
    const { getByText } = wrap(
      <PassBanner passDirection="right" selectedCount={2} onConfirm={jest.fn()} />
    );
    expect(getByText(/2 of 3 selected/i)).toBeTruthy();
  });

  it("confirm button is disabled when fewer than 3 cards selected", () => {
    const { getByRole } = wrap(
      <PassBanner passDirection="left" selectedCount={1} onConfirm={jest.fn()} />
    );
    expect(getByRole("button", { name: /confirm/i }).props.accessibilityState?.disabled).toBe(true);
  });

  it("confirm button is enabled and fires onConfirm when exactly 3 selected", () => {
    const onConfirm = jest.fn();
    const { getByRole } = wrap(
      <PassBanner passDirection="across" selectedCount={3} onConfirm={onConfirm} />
    );
    const btn = getByRole("button", { name: /confirm/i });
    expect(btn.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("does not render a Modal (inline UI, not overlay)", () => {
    const { UNSAFE_queryAllByType } = wrap(
      <PassBanner passDirection="left" selectedCount={0} onConfirm={jest.fn()} />
    );
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Modal } = require("react-native");
    expect(UNSAFE_queryAllByType(Modal)).toHaveLength(0);
  });
});
