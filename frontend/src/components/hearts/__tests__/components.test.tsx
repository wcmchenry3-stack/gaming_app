import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../../../theme/ThemeContext";
import PlayingCard from "../PlayingCard";
import PlayerHand from "../PlayerHand";
import OpponentHand from "../OpponentHand";
import TrickArea from "../TrickArea";
import ScoreBoard from "../ScoreBoard";
import PassingOverlay from "../PassingOverlay";
import type { Card, TrickCard } from "../../../game/hearts/types";

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
    const { getAllByRole } = wrap(<PlayerHand hand={hand} onCardPress={onPress} />);
    fireEvent.press(getAllByRole("button")[1]!);
    expect(onPress).toHaveBeenCalledWith(hand[1]);
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
  const hand = [3, 2, 8, 0];

  it("renders all player labels", () => {
    const { getByText } = wrap(
      <ScoreBoard playerLabels={labels} cumulativeScores={cumulative} handScores={hand} />
    );
    labels.forEach((l) => expect(getByText(l)).toBeTruthy());
  });

  it("renders cumulative scores", () => {
    const { getByText } = wrap(
      <ScoreBoard playerLabels={labels} cumulativeScores={cumulative} handScores={hand} />
    );
    expect(getByText("20")).toBeTruthy();
  });

  it("renders positive hand delta with + prefix", () => {
    const { getByText } = wrap(
      <ScoreBoard playerLabels={labels} cumulativeScores={cumulative} handScores={[5, 0, 0, 0]} />
    );
    expect(getByText("+5")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// PassingOverlay
// ---------------------------------------------------------------------------

describe("PassingOverlay", () => {
  const hand: Card[] = [c("spades", 1), c("hearts", 13), c("clubs", 7), c("diamonds", 4)];

  it("renders instructions with direction", () => {
    const { getByText } = wrap(
      <PassingOverlay
        hand={hand}
        passDirection="left"
        selectedCards={[]}
        onCardPress={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    expect(getByText(/pass left/i)).toBeTruthy();
  });

  it("confirm button is disabled when fewer than 3 cards selected", () => {
    const { getByRole } = wrap(
      <PassingOverlay
        hand={hand}
        passDirection="left"
        selectedCards={[hand[0]!]}
        onCardPress={jest.fn()}
        onConfirm={jest.fn()}
      />
    );
    expect(getByRole("button", { name: /confirm/i }).props.accessibilityState?.disabled).toBe(true);
  });

  it("confirm button is enabled when exactly 3 cards selected", () => {
    const onConfirm = jest.fn();
    const { getByRole } = wrap(
      <PassingOverlay
        hand={hand}
        passDirection="right"
        selectedCards={[hand[0]!, hand[1]!, hand[2]!]}
        onCardPress={jest.fn()}
        onConfirm={onConfirm}
      />
    );
    const btn = getByRole("button", { name: /confirm/i });
    expect(btn.props.accessibilityState?.disabled).toBe(false);
    fireEvent.press(btn);
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
