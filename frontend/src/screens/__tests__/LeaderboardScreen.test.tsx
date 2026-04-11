import React from "react";
import { render, screen } from "@testing-library/react-native";
import { ThemeProvider } from "../../theme/ThemeContext";
import LeaderboardScreen from "../LeaderboardScreen";

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

function renderScreen() {
  return render(
    <ThemeProvider>
      <LeaderboardScreen />
    </ThemeProvider>
  );
}

describe("LeaderboardScreen", () => {
  it("renders the AppHeader", () => {
    renderScreen();
    expect(screen.getByRole("header")).toBeTruthy();
  });

  it("renders the coming soon placeholder", () => {
    renderScreen();
    expect(screen.getByText("Coming Soon")).toBeTruthy();
  });
});
