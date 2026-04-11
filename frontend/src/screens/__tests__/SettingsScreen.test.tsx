import React from "react";
import { render, screen, fireEvent } from "@testing-library/react-native";
import { ThemeProvider } from "../../theme/ThemeContext";
import SettingsScreen from "../SettingsScreen";

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("../../components/LanguageSwitcher", () => ({
  __esModule: true,
  default: "MockLanguageSwitcher",
}));

function renderScreen() {
  return render(
    <ThemeProvider>
      <SettingsScreen />
    </ThemeProvider>
  );
}

describe("SettingsScreen", () => {
  it("renders the AppHeader", () => {
    renderScreen();
    expect(screen.getByRole("header")).toBeTruthy();
  });

  it("renders the theme toggle button", () => {
    renderScreen();
    expect(screen.getByTestId("theme-toggle-button")).toBeTruthy();
  });

  it("theme toggle button responds to press", () => {
    renderScreen();
    const toggle = screen.getByTestId("theme-toggle-button");
    const labelBefore = toggle.props.accessibilityLabel;
    fireEvent.press(toggle);
    const labelAfter = screen.getByTestId("theme-toggle-button").props.accessibilityLabel;
    expect(labelAfter).not.toBe(labelBefore);
  });
});
