import React from "react";
import { render } from "@testing-library/react-native";
import ActionButtons from "../ActionButtons";
import { ThemeProvider } from "../../../theme/ThemeContext";

function renderButtons(doubleDownAvailable: boolean) {
  return render(
    <ThemeProvider>
      <ActionButtons
        onHit={jest.fn()}
        onStand={jest.fn()}
        onDoubleDown={jest.fn()}
        doubleDownAvailable={doubleDownAvailable}
        loading={false}
      />
    </ThemeProvider>
  );
}

describe("ActionButtons", () => {
  it("renders Hit, Stand, and Double Down buttons", () => {
    const { getByText } = renderButtons(true);
    expect(getByText("Hit")).toBeTruthy();
    expect(getByText("Stand")).toBeTruthy();
    expect(getByText("Double Down")).toBeTruthy();
  });

  it("Double Down has disabled accessibility label when doubleDownAvailable is false", () => {
    const { getByLabelText } = renderButtons(false);
    expect(getByLabelText("Double down not available")).toBeTruthy();
  });

  it("Double Down has enabled accessibility label when doubleDownAvailable is true", () => {
    const { getByLabelText } = renderButtons(true);
    expect(
      getByLabelText("Double down — double bet and take one card")
    ).toBeTruthy();
  });

  it("Double Down button has accessibilityState disabled=true when unavailable", () => {
    const { getByLabelText } = renderButtons(false);
    const btn = getByLabelText("Double down not available");
    expect(btn.props.accessibilityState?.disabled).toBe(true);
  });

  it("Double Down button has accessibilityState disabled=false when available", () => {
    const { getByLabelText } = renderButtons(true);
    const btn = getByLabelText("Double down — double bet and take one card");
    expect(btn.props.accessibilityState?.disabled).toBe(false);
  });
});
