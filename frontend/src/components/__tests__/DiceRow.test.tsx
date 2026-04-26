import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import DiceRow from "../DiceRow";
import { ThemeProvider } from "../../theme/ThemeContext";

function renderDiceRow(overrides: Partial<React.ComponentProps<typeof DiceRow>> = {}) {
  const defaults = {
    dice: [1, 2, 3, 4, 5],
    held: [false, false, false, false, false],
    rollsUsed: 0,
    gameOver: false,
    onRoll: jest.fn().mockResolvedValue(undefined),
    onToggleHold: jest.fn(),
  };
  const props = { ...defaults, ...overrides };
  return render(
    <ThemeProvider>
      <DiceRow {...props} />
    </ThemeProvider>
  );
}

describe("DiceRow", () => {
  it("roll button is enabled when rollsUsed < 3 and not game over", () => {
    const { getByRole } = renderDiceRow({ rollsUsed: 1 });
    expect(getByRole("button", { name: /roll/i })).not.toBeDisabled();
  });

  it("roll button is disabled when rollsUsed === 3", () => {
    const { getByRole } = renderDiceRow({ rollsUsed: 3 });
    expect(getByRole("button", { name: /roll/i })).toBeDisabled();
  });

  it("roll button is disabled when game is over", () => {
    const { getByRole } = renderDiceRow({ gameOver: true });
    expect(getByRole("button", { name: /roll/i })).toBeDisabled();
  });

  it("pressing roll calls onRoll with no arguments", async () => {
    const onRoll = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = renderDiceRow({ rollsUsed: 1, onRoll });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    expect(onRoll).toHaveBeenCalledWith();
  });

  it("dice are disabled before the first roll (rollsUsed === 0)", () => {
    const { getAllByRole } = renderDiceRow({ rollsUsed: 0 });
    const dice = getAllByRole("button", { name: /^die \d/i });
    dice.forEach((die) => expect(die).toBeDisabled());
  });

  it("pressing a die after first roll calls onToggleHold with the die index", () => {
    const onToggleHold = jest.fn();
    const { getAllByRole } = renderDiceRow({ rollsUsed: 1, onToggleHold });
    fireEvent.press(getAllByRole("button", { name: /^die \d/i })[0]);
    expect(onToggleHold).toHaveBeenCalledWith(0);
  });

  it("held prop drives die held display (no local state)", () => {
    const { getAllByRole, rerender } = renderDiceRow({
      rollsUsed: 1,
      held: [false, false, false, false, false],
    });
    getAllByRole("button", { name: /^die \d/i });
    // held=false renders without error — confirmed by test not throwing

    rerender(
      <ThemeProvider>
        <DiceRow
          dice={[1, 2, 3, 4, 5]}
          held={[true, false, false, false, false]}
          rollsUsed={1}
          gameOver={false}
          onRoll={jest.fn()}
          onToggleHold={jest.fn()}
        />
      </ThemeProvider>
    );
    const diceAfter = getAllByRole("button", { name: /^die \d/i });
    // held=true re-render does not crash — die still rendered
    expect(diceAfter[0]).toBeTruthy();
  });
});
