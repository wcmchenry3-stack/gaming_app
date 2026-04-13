import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../../theme/ThemeContext";
import SettingsScreen from "../SettingsScreen";

const mockClearAll = jest.fn().mockResolvedValue(undefined);
jest.mock("../../game/_shared/gameEventClient", () => ({
  gameEventClient: {
    clearAll: (...args: unknown[]) => mockClearAll(...args),
  },
}));

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

  describe("Clear local logs", () => {
    beforeEach(() => {
      mockClearAll.mockClear();
    });

    it("renders the clear logs button", () => {
      renderScreen();
      expect(screen.getByTestId("clear-logs-button")).toBeTruthy();
    });

    it("tapping the button opens the confirmation modal", () => {
      renderScreen();
      fireEvent.press(screen.getByTestId("clear-logs-button"));
      expect(screen.getByTestId("clear-logs-confirm")).toBeTruthy();
      expect(screen.getByTestId("clear-logs-cancel")).toBeTruthy();
    });

    it("cancel dismisses the modal without calling clearAll", () => {
      renderScreen();
      fireEvent.press(screen.getByTestId("clear-logs-button"));
      fireEvent.press(screen.getByTestId("clear-logs-cancel"));
      expect(mockClearAll).not.toHaveBeenCalled();
    });

    it("confirm calls gameEventClient.clearAll", async () => {
      renderScreen();
      fireEvent.press(screen.getByTestId("clear-logs-button"));
      fireEvent.press(screen.getByTestId("clear-logs-confirm"));
      await waitFor(() => expect(mockClearAll).toHaveBeenCalledTimes(1));
    });
  });
});
