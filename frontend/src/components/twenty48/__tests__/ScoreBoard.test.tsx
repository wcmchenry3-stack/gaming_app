import React from "react";
import { render } from "@testing-library/react-native";
import ScoreBoard from "../ScoreBoard";
import { ThemeProvider } from "../../../theme/ThemeContext";

function renderScoreBoard(score: number) {
  return render(
    <ThemeProvider>
      <ScoreBoard score={score} />
    </ThemeProvider>
  );
}

describe("ScoreBoard", () => {
  it("renders the numeric score", () => {
    const { getByText } = renderScoreBoard(1024);
    expect(getByText("1024")).toBeTruthy();
  });

  it("renders score of 0", () => {
    const { getByText } = renderScoreBoard(0);
    expect(getByText("0")).toBeTruthy();
  });

  it("renders 'Score' label text", () => {
    const { getByText } = renderScoreBoard(0);
    expect(getByText("Score")).toBeTruthy();
  });

  it("applies i18n accessibilityLabel with interpolated score", () => {
    const { getByLabelText } = renderScoreBoard(512);
    expect(getByLabelText("Current score: 512")).toBeTruthy();
  });

  it("updates accessibilityLabel when score prop changes", () => {
    const { getByLabelText, rerender } = renderScoreBoard(100);
    expect(getByLabelText("Current score: 100")).toBeTruthy();
    rerender(
      <ThemeProvider>
        <ScoreBoard score={200} />
      </ThemeProvider>
    );
    expect(getByLabelText("Current score: 200")).toBeTruthy();
  });

  it("updates displayed value when score prop changes", () => {
    const { getByText, rerender } = renderScoreBoard(100);
    expect(getByText("100")).toBeTruthy();
    rerender(
      <ThemeProvider>
        <ScoreBoard score={9999} />
      </ThemeProvider>
    );
    expect(getByText("9999")).toBeTruthy();
  });
});
