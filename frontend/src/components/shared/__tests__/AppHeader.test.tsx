import React from "react";
import { Text } from "react-native";
import { render, screen } from "@testing-library/react-native";
import { AppHeader, APP_HEADER_HEIGHT } from "../AppHeader";

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 0, left: 0, right: 0 }),
}));

jest.mock("../../../theme/ThemeContext", () => ({
  useTheme: () => ({
    colors: {
      background: "#0e0e13",
      accent: "#8ff5ff",
      text: "#e8e8f0",
    },
    theme: "dark",
  }),
}));

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => (key === "brand.wordmark" ? "BC Arcade" : key),
  }),
}));

describe("AppHeader", () => {
  it("renders the page title", () => {
    render(<AppHeader title="Settings" />);
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders the BC Arcade wordmark", () => {
    render(<AppHeader title="Profile" />);
    expect(screen.getByText("BC Arcade")).toBeTruthy();
  });

  it("projects the rightSlot when provided", () => {
    render(
      <AppHeader title="Game" rightSlot={<Text>Round 3 / 13</Text>} />
    );
    expect(screen.getByText("Round 3 / 13")).toBeTruthy();
  });

  it("renders nothing in the right slot when omitted", () => {
    render(<AppHeader title="Ranks" />);
    expect(screen.queryByText("Round")).toBeNull();
  });

  it("has an accessible header role on the wrapper", () => {
    const { getByRole } = render(<AppHeader title="Lobby" />);
    expect(getByRole("header", { name: "Lobby" })).toBeTruthy();
  });

  it("does not render a back button", () => {
    render(<AppHeader title="2048" />);
    expect(screen.queryByText(/back/i)).toBeNull();
    expect(screen.queryByText(/←/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("exports APP_HEADER_HEIGHT as a positive number", () => {
    expect(typeof APP_HEADER_HEIGHT).toBe("number");
    expect(APP_HEADER_HEIGHT).toBeGreaterThan(0);
  });
});
