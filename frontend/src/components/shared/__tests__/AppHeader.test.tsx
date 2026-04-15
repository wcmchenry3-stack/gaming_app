import React from "react";
import { Text } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { AppHeader, APP_HEADER_HEIGHT } from "../AppHeader";

jest.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      if (key === "common:nav.back") return "← Back";
      if (key === "common:nav.backLabel") return "Go back to home screen";
      if (key === "fab_label") return "Send feedback";
      return key;
    },
  }),
}));

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
      textOnAccent: "#0e0e13",
    },
    theme: "dark",
  }),
}));

jest.mock("../../FeedbackWidget/FeedbackWidget", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text: RNText } = require("react-native");
  const FeedbackWidgetMock = ({ visible }: { visible: boolean; onClose: () => void }) =>
    visible ? <RNText>FeedbackWidgetMock</RNText> : null;
  FeedbackWidgetMock.displayName = "FeedbackWidgetMock";
  return FeedbackWidgetMock;
});

jest.mock("../../../../assets/logo.png", () => 1);

const mockAddBreadcrumb = jest.fn();
const mockCaptureMessage = jest.fn();
jest.mock("@sentry/react-native", () => ({
  addBreadcrumb: (...args: unknown[]) => mockAddBreadcrumb(...args),
  captureMessage: (...args: unknown[]) => mockCaptureMessage(...args),
}));

beforeEach(() => {
  mockAddBreadcrumb.mockClear();
  mockCaptureMessage.mockClear();
});

describe("AppHeader", () => {
  it("renders the page title", () => {
    render(<AppHeader title="Settings" />);
    expect(screen.getByText("Settings")).toBeTruthy();
  });

  it("renders the BC Arcade logo image", () => {
    render(<AppHeader title="Profile" />);
    expect(screen.getByLabelText("BC Arcade")).toBeTruthy();
  });

  it("projects the rightSlot when provided", () => {
    render(<AppHeader title="Game" rightSlot={<Text>Round 3 / 13</Text>} />);
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

  it("renders a help button that opens the FeedbackWidget when pressed", () => {
    render(<AppHeader title="2048" />);
    const helpBtn = screen.getByRole("button", { name: "Send feedback" });
    expect(helpBtn).toBeTruthy();
    expect(screen.queryByText("FeedbackWidgetMock")).toBeNull();
    fireEvent.press(helpBtn);
    expect(screen.getByText("FeedbackWidgetMock")).toBeTruthy();
  });

  it("renders a back button and hides the logo when onBack is provided", () => {
    const onBack = jest.fn();
    render(<AppHeader title="2048" onBack={onBack} />);
    const button = screen.getByRole("button", { name: "Go back to home screen" });
    expect(button).toBeTruthy();
    expect(screen.queryByLabelText("BC Arcade")).toBeNull();
    fireEvent.press(button);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("exports APP_HEADER_HEIGHT as a positive number", () => {
    expect(typeof APP_HEADER_HEIGHT).toBe("number");
    expect(APP_HEADER_HEIGHT).toBeGreaterThan(0);
  });

  // #498 — telemetry: surface regressions where a screen silently drops
  // onBack or the tap never reaches the handler.
  describe("telemetry", () => {
    it("records a mount breadcrumb with hasBack flag", () => {
      render(<AppHeader title="Yacht" onBack={() => {}} requireBack />);
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "ui.header",
          message: "AppHeader mount",
          data: { title: "Yacht", hasBack: true, requireBack: true },
        })
      );
    });

    it("captures a Sentry warning when requireBack is set but onBack is missing", () => {
      render(<AppHeader title="Yacht" requireBack />);
      expect(mockCaptureMessage).toHaveBeenCalledWith(expect.stringContaining("Yacht"), "warning");
    });

    it("does not warn when requireBack is unset", () => {
      render(<AppHeader title="Lobby" />);
      expect(mockCaptureMessage).not.toHaveBeenCalled();
    });

    it("records a tap breadcrumb before invoking onBack", () => {
      const onBack = jest.fn();
      render(<AppHeader title="Yacht" onBack={onBack} requireBack />);
      mockAddBreadcrumb.mockClear();
      fireEvent.press(screen.getByRole("button", { name: "Go back to home screen" }));
      expect(mockAddBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          category: "ui.header",
          message: "AppHeader back press",
          data: { title: "Yacht" },
        })
      );
      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });
});
