import React from "react";
import { render, act } from "@testing-library/react-native";
import ScoreboardScreen from "../ScoreboardScreen";
import { ThemeProvider } from "../../theme/ThemeContext";
import { HeartsRoundsProvider, useHeartsRounds } from "../../game/hearts/RoundsContext";
import { YachtScorecardProvider, useYachtScorecard } from "../../game/yacht/ScorecardContext";

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
        <YachtScorecardProvider>
          <ScoreboardScreen />
        </YachtScorecardProvider>
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
        <YachtScorecardProvider>
          <Seed {...seedProps} />
          <ScoreboardScreen />
        </YachtScorecardProvider>
      </HeartsRoundsProvider>
    </ThemeProvider>
  );
}

function YachtSeed({
  scores,
  totalScore,
}: {
  scores: Record<string, number | null>;
  totalScore: number;
}) {
  const { setSnapshot } = useYachtScorecard();
  React.useEffect(() => {
    setSnapshot({
      scores,
      upperSubtotal: 0,
      upperBonus: 0,
      yachtBonusCount: 0,
      totalScore,
    });
  }, [scores, totalScore, setSnapshot]);
  return null;
}

function renderYachtWithSeed(scores: Record<string, number | null>, totalScore: number) {
  return render(
    <ThemeProvider>
      <HeartsRoundsProvider>
        <YachtScorecardProvider>
          <YachtSeed scores={scores} totalScore={totalScore} />
          <ScoreboardScreen />
        </YachtScorecardProvider>
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

  it("renders the Yacht variant when gameKey is yacht", () => {
    useRoute.mockReturnValue({ params: { gameKey: "yacht" } });
    const { getByText } = renderYachtWithSeed(
      { ones: 3, twos: null, full_house: null, yacht: 50 },
      53
    );
    act(() => {
      // flush the seed effect
    });
    // Yacht variant renders the scored values plus the upper-bonus countdown.
    expect(getByText("3")).toBeTruthy();
    expect(getByText("50")).toBeTruthy();
    expect(getByText(/more for \+35/)).toBeTruthy();
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
