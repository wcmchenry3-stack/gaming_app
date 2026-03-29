import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import BettingPanel from "../BettingPanel";
import { ThemeProvider } from "../../../theme/ThemeContext";

function renderPanel(
  overrides: Partial<{ chips: number; loading: boolean; error: string | null }> = {}
) {
  const onDeal = jest.fn();
  const { chips = 1000, loading = false, error = null } = overrides;
  const utils = render(
    <ThemeProvider>
      <BettingPanel chips={chips} onDeal={onDeal} loading={loading} error={error} />
    </ThemeProvider>
  );
  return { ...utils, onDeal };
}

describe("BettingPanel", () => {
  it("renders chip count", () => {
    const { getByText } = renderPanel({ chips: 500 });
    expect(getByText("500 chips")).toBeTruthy();
  });

  it("renders Deal button", () => {
    const { getByText } = renderPanel();
    expect(getByText("Deal")).toBeTruthy();
  });

  it("calls onDeal with current bet amount when Deal pressed", () => {
    const { getByText, onDeal } = renderPanel({ chips: 1000 });
    fireEvent.press(getByText("Deal"));
    expect(onDeal).toHaveBeenCalledWith(expect.any(Number));
  });

  it("does not call onDeal when loading", () => {
    const { getByText, onDeal } = renderPanel({ loading: true });
    fireEvent.press(getByText("Deal"));
    expect(onDeal).not.toHaveBeenCalled();
  });

  it("renders error message when error prop is set", () => {
    const { getByText } = renderPanel({ error: "Something went wrong" });
    expect(getByText("Something went wrong")).toBeTruthy();
  });

  it("renders decrease and increase buttons", () => {
    const { getByLabelText } = renderPanel();
    expect(getByLabelText("Decrease bet by 10")).toBeTruthy();
    expect(getByLabelText("Increase bet by 10")).toBeTruthy();
  });

  it("increase button updates displayed bet", () => {
    const { getByLabelText, getByText } = renderPanel({ chips: 1000 });
    fireEvent.press(getByLabelText("Increase bet by 10"));
    expect(getByText("110 chips")).toBeTruthy();
  });
});
