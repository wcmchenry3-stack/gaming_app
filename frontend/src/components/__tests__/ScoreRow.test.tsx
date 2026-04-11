import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import ScoreRow from "../ScoreRow";
import { ThemeProvider } from "../../theme/ThemeContext";

function renderRow(overrides: Partial<React.ComponentProps<typeof ScoreRow>> = {}) {
  const defaults = {
    label: "Ones",
    category: "ones",
    tone: "upper" as const,
    score: null,
    potential: undefined,
    canScore: false,
    onSelect: jest.fn(),
  };
  return render(
    <ThemeProvider>
      <ScoreRow {...defaults} {...overrides} />
    </ThemeProvider>
  );
}

describe("ScoreRow", () => {
  it("renders empty state with dash when no score and no potential", () => {
    const { getByText, getByRole } = renderRow();
    expect(getByText("—")).toBeTruthy();
    expect(getByRole("button").props.accessibilityState.disabled).toBe(true);
  });

  it("renders potential state when canScore and potential defined", () => {
    const { getByText } = renderRow({ canScore: true, potential: 12 });
    expect(getByText("12")).toBeTruthy();
  });

  it("renders filled state with score and is not pressable", () => {
    const onSelect = jest.fn();
    const { getByText, getByRole } = renderRow({ score: 9, onSelect });
    expect(getByText("9")).toBeTruthy();
    fireEvent.press(getByRole("button"));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("fires onSelect only when canScore and not filled", () => {
    const onSelect = jest.fn();
    const { getByRole } = renderRow({ canScore: true, potential: 5, onSelect });
    fireEvent.press(getByRole("button"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("accepts lower tone without crashing", () => {
    const { getByRole } = renderRow({ category: "yacht", tone: "lower", score: 50 });
    expect(getByRole("button")).toBeTruthy();
  });
});
