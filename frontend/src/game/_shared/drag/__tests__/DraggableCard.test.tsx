import React from "react";
import { Text } from "react-native";
import { render, fireEvent } from "@testing-library/react-native";

import { ThemeProvider } from "../../../../theme/ThemeContext";
import { DragProvider } from "../DragContext";
import { DraggableCard } from "../DraggableCard";

const dragCards = [{ suit: "spades" as const, rank: 1, faceDown: false, width: 60, height: 90 }];
const dragSource = { game: "solitaire" as const, type: "tableau" as const, col: 0, fromIndex: 0 };

function wrap(children: React.ReactNode) {
  return (
    <DragProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </DragProvider>
  );
}

describe("DraggableCard", () => {
  it("fires onTap when the card is pressed", () => {
    const onTap = jest.fn();
    const { getByRole } = render(
      wrap(
        <DraggableCard onTap={onTap} dragCards={dragCards} dragSource={dragSource}>
          <Text accessibilityRole="button">A♠</Text>
        </DraggableCard>
      )
    );
    fireEvent.press(getByRole("button"));
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it("does not fire onTap when draggable=false and no onTap is provided", () => {
    // Renders without error when neither drag nor tap handler is configured.
    const { getByText } = render(
      wrap(
        <DraggableCard dragCards={dragCards} dragSource={dragSource} draggable={false}>
          <Text>A♠</Text>
        </DraggableCard>
      )
    );
    expect(getByText("A♠")).toBeTruthy();
  });

  it("does not fire onTap when the card has no onTap prop", () => {
    const { getByRole } = render(
      wrap(
        <DraggableCard dragCards={dragCards} dragSource={dragSource}>
          <Text accessibilityRole="button">A♠</Text>
        </DraggableCard>
      )
    );
    // Should not throw when pressed without an onTap handler.
    expect(() => fireEvent.press(getByRole("button"))).not.toThrow();
  });
});
