import React from "react";
import { render } from "@testing-library/react-native";
import PlayerStatus from "../PlayerStatus";
import { ThemeProvider } from "../../../theme/ThemeContext";
import { PlayerStateResponse } from "../../../game/ludo/api";

function makePlayerState(player_id: string, overrides = {}): PlayerStateResponse {
  return {
    player_id,
    pieces: [],
    pieces_home: 4,
    pieces_finished: 0,
    ...overrides,
  };
}

function renderStatus(
  playerStates: PlayerStateResponse[],
  currentPlayer: string,
  humanPlayer = "red"
) {
  return render(
    <ThemeProvider>
      <PlayerStatus
        playerStates={playerStates}
        currentPlayer={currentPlayer}
        humanPlayer={humanPlayer}
      />
    </ThemeProvider>
  );
}

describe("PlayerStatus", () => {
  const states = [makePlayerState("red"), makePlayerState("yellow")];

  it('shows "You" for human player', () => {
    const { getByText } = renderStatus(states, "yellow", "red");
    expect(getByText("You")).toBeTruthy();
  });

  it('shows "CPU" for cpu player', () => {
    const { getByText } = renderStatus(states, "red", "red");
    expect(getByText("CPU")).toBeTruthy();
  });

  it('shows "Your turn" badge for the current human player', () => {
    const { getByText } = renderStatus(states, "red", "red");
    expect(getByText("Your turn")).toBeTruthy();
  });

  it("shows CPU's turn badge when cpu is current", () => {
    const { getByText } = renderStatus(states, "yellow", "red");
    expect(getByText("CPU's turn")).toBeTruthy();
  });
});
