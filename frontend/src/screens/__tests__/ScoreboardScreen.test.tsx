import React from "react";
import { render, act } from "@testing-library/react-native";
import ScoreboardScreen from "../ScoreboardScreen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { HeartsRoundsProvider, useHeartsRounds } from "../../game/hearts/RoundsContext";

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
  useRoute: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useRoute } = require("@react-navigation/native");

function renderScreen() {
  return render(
    <ThemeProvider>
      <HeartsRoundsProvider>
        <ScoreboardScreen />
      </HeartsRoundsProvider>
    </ThemeProvider>
  );
}

// Tiny seed component so we can populate the rounds context before
// ScoreboardScreen reads from it.
function Seed({
  cumulativeScores,
  scoreHistory,
  playerLabels,
}: {
  cumulativeScores: number[];
  scoreHistory: number[][];
  playerLabels: string[];
}) {
  const { setSnapshot } = useHeartsRounds();
  React.useEffect(() => {
    setSnapshot({ cumulativeScores, scoreHistory, playerLabels });
  }, [cumulativeScores, scoreHistory, playerLabels, setSnapshot]);
  return null;
}

function renderWithSeed(seedProps: {
  cumulativeScores: number[];
  scoreHistory: number[][];
  playerLabels: string[];
}) {
  return render(
    <ThemeProvider>
      <HeartsRoundsProvider>
        <Seed {...seedProps} />
        <ScoreboardScreen />
      </HeartsRoundsProvider>
    </ThemeProvider>
  );
}

describe("ScoreboardScreen", () => {
  beforeEach(() => {
    useRoute.mockReset();
  });

  it("renders the Hearts variant when gameKey is hearts", () => {
    useRoute.mockReturnValue({ params: { gameKey: "hearts" } });
    const utils = renderWithSeed({
      cumulativeScores: [13, 25, 41, 59],
      scoreHistory: [],
      playerLabels: ["You", "West", "North", "East"],
    });
    act(() => {
      // flush the seed effect
    });
    // Hearts variant exposes single-letter header initials.
    expect(utils.getByText("Y")).toBeTruthy();
    expect(utils.getByText(/shooter zeroes/)).toBeTruthy();
  });

  it("renders the yacht fallback while the variant is unbuilt", () => {
    useRoute.mockReturnValue({ params: { gameKey: "yacht" } });
    const { getByText } = renderScreen();
    expect(getByText(/No scoreboard available for/)).toBeTruthy();
  });

  it("renders the blackjack fallback while the variant is unbuilt", () => {
    useRoute.mockReturnValue({ params: { gameKey: "blackjack" } });
    const { getByText } = renderScreen();
    expect(getByText(/No scoreboard available for/)).toBeTruthy();
  });

  it("renders a fallback for an entirely unknown gameKey", () => {
    useRoute.mockReturnValue({ params: { gameKey: "no-such-game" } });
    const { getByText } = renderScreen();
    expect(getByText(/No scoreboard available for/)).toBeTruthy();
  });
});
