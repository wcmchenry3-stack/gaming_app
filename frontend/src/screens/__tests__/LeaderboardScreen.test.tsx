import React from "react";
import { render, screen, waitFor } from "@testing-library/react-native";
import { ThemeProvider } from "../../theme/ThemeContext";
import LeaderboardScreen from "../LeaderboardScreen";

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("expo-linear-gradient", () => ({
  LinearGradient: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

const mockGetLeaderboard = jest.fn() as jest.Mock<Promise<{ scores: unknown[] }>>;
jest.mock("../../game/starswarm/api", () => ({
  starSwarmApi: {
    getLeaderboard: () => mockGetLeaderboard(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockGetLeaderboard.mockResolvedValue({ scores: [] });
});

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

  it("shows a loading indicator before the API resolves", () => {
    mockGetLeaderboard.mockImplementation(() => new Promise(() => {}));
    renderScreen();
    expect(screen.getByLabelText("Loading")).toBeTruthy();
  });

  it("shows empty-state text when there are no scores", async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText("leaderboard.empty")).toBeTruthy();
    });
  });
});
