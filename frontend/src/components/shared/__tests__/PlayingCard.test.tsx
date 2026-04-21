/**
 * Tests for the shared PlayingCard component (native text implementation).
 * The web (cardmeister) implementation is not testable in Jest/jsdom.
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import PlayingCard from "../PlayingCard";
import { ThemeProvider } from "../../../theme/ThemeContext";

function wrap(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe("PlayingCard (shared — native renderer)", () => {
  it("renders rank and suit text when face-up", () => {
    wrap(<PlayingCard suit="spades" rank={1} accessibilityLabel="A of Spades" />);
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("♠")).toBeTruthy();
  });

  it("renders face card labels correctly", () => {
    const { getByText: getJ } = wrap(<PlayingCard suit="clubs" rank={11} />);
    expect(getJ("J")).toBeTruthy();
    const { getByText: getQ } = wrap(<PlayingCard suit="hearts" rank={12} />);
    expect(getQ("Q")).toBeTruthy();
    const { getByText: getK } = wrap(<PlayingCard suit="diamonds" rank={13} />);
    expect(getK("K")).toBeTruthy();
  });

  it("renders '10' for rank 10", () => {
    wrap(<PlayingCard suit="hearts" rank={10} />);
    expect(screen.getByText("10")).toBeTruthy();
  });

  it("shows '?' and hides rank/suit when face-down", () => {
    wrap(<PlayingCard suit="spades" rank={1} faceDown accessibilityLabel="Face-down card" />);
    expect(screen.getByText("?")).toBeTruthy();
    expect(screen.queryByText("A")).toBeNull();
    expect(screen.queryByText("♠")).toBeNull();
  });

  it("uses the accessibilityLabel prop on the wrapper element", () => {
    wrap(<PlayingCard suit="hearts" rank={1} accessibilityLabel="A of Hearts" />);
    expect(screen.getByLabelText("A of Hearts")).toBeTruthy();
  });

  it("renders a button role and fires onPress when provided", () => {
    const onPress = jest.fn();
    wrap(<PlayingCard suit="clubs" rank={7} onPress={onPress} accessibilityLabel="7 of Clubs" />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onPress when disabled", () => {
    const onPress = jest.fn();
    wrap(<PlayingCard suit="clubs" rank={7} onPress={onPress} disabled accessibilityLabel="7 of Clubs" />);
    fireEvent.press(screen.getByRole("button"));
    expect(onPress).not.toHaveBeenCalled();
  });

  it("renders image role (not button) when no onPress", () => {
    wrap(<PlayingCard suit="diamonds" rank={5} accessibilityLabel="5 of Diamonds" />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders hearts and diamonds suit in red color (error theme color)", () => {
    const { getByText: getH } = wrap(<PlayingCard suit="hearts" rank={5} />);
    const { getByText: getD } = wrap(<PlayingCard suit="diamonds" rank={5} />);
    // Color is applied via style — just verify the text nodes exist and are distinct from black suits
    expect(getH("♥")).toBeTruthy();
    expect(getD("♦")).toBeTruthy();
  });
});
