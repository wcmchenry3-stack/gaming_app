import React from "react";
import { render, fireEvent, act } from "@testing-library/react-native";
import DiceRow from "../DiceRow";
import { ThemeProvider } from "../../theme/ThemeContext";

function renderDiceRow(overrides: Partial<React.ComponentProps<typeof DiceRow>> = {}) {
  const defaults = {
    dice: [1, 2, 3, 4, 5],
    rollsUsed: 0,
    gameOver: false,
    onRoll: jest.fn().mockResolvedValue(undefined),
    resetHeld: false,
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

  it("pressing roll calls onRoll with held state", async () => {
    const onRoll = jest.fn().mockResolvedValue(undefined);
    const { getByRole } = renderDiceRow({ rollsUsed: 1, onRoll });
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    expect(onRoll).toHaveBeenCalledWith([false, false, false, false, false]);
  });

  it("dice are disabled before the first roll (rollsUsed === 0)", () => {
    const { getAllByRole } = renderDiceRow({ rollsUsed: 0 });
    // Die uses accessibilityRole="togglebutton"
    const dice = getAllByRole("togglebutton");
    dice.forEach((die) => expect(die).toBeDisabled());
  });

  it("toggling a die after first roll includes it in the held array passed to onRoll", async () => {
    const onRoll = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByRole } = renderDiceRow({ rollsUsed: 1, onRoll });
    // Hold die at index 0
    fireEvent.press(getAllByRole("togglebutton")[0]);
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    expect(onRoll).toHaveBeenCalledWith([true, false, false, false, false]);
  });

  it("resetHeld prop change clears all held dice", async () => {
    const onRoll = jest.fn().mockResolvedValue(undefined);
    const { getAllByRole, getByRole, rerender } = renderDiceRow({
      rollsUsed: 1,
      onRoll,
      resetHeld: false,
    });
    // Hold die 0
    fireEvent.press(getAllByRole("togglebutton")[0]);
    // Simulate resetHeld toggle (e.g., after scoring)
    rerender(
      <ThemeProvider>
        <DiceRow
          dice={[1, 2, 3, 4, 5]}
          rollsUsed={1}
          gameOver={false}
          onRoll={onRoll}
          resetHeld={true}
        />
      </ThemeProvider>
    );
    await act(async () => {
      fireEvent.press(getByRole("button", { name: /roll dice/i }));
    });
    expect(onRoll).toHaveBeenCalledWith([false, false, false, false, false]);
  });
});
