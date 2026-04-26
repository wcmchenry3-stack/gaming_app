/**
 * Smoke tests for the Mahjong GameCanvas component.
 *
 * Canvas rendering (Skia / Canvas 2D) is not assertable in Jest — tests
 * verify that the component mounts without crashing and that overlays
 * appear for the correct game states.
 */

import React from "react";
import { create, act } from "react-test-renderer";
import type { MahjongState } from "../../../game/mahjong/types";
import { createGame } from "../../../game/mahjong/engine";
import { TURTLE_LAYOUT } from "../../../game/mahjong/layouts/turtle";

// Skia requires a native module — stub the whole package.
jest.mock("@shopify/react-native-skia", () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Fill: () => null,
  Group: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  Rect: () => null,
}));

// Use the web variant (no Skia). The canvas ref will be null in jsdom, which
// the component handles gracefully via the `if (!ctx) return` guard.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { default: GameCanvas } = require("../GameCanvas.web");

function makeState(overrides: Partial<MahjongState> = {}): MahjongState {
  return { ...createGame(TURTLE_LAYOUT, 12345), ...overrides };
}

const noop = () => {};

describe("GameCanvas (web)", () => {
  it("renders without crashing on a fresh game", () => {
    expect(() => {
      act(() => {
        create(
          <GameCanvas
            state={makeState()}
            onTilePress={noop}
            onShufflePress={noop}
            onNewGamePress={noop}
          />
        );
      });
    }).not.toThrow();
  });

  it("shows the win overlay when isComplete", () => {
    const state = makeState({ isComplete: true, tiles: [], pairsRemoved: 72, score: 1220 });
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <GameCanvas state={state} onTilePress={noop} onShufflePress={noop} onNewGamePress={noop} />
      );
    });
    // i18n returns keys in tests — check for the key, not the translated string.
    expect(JSON.stringify(tree!.toJSON())).toContain("overlay.youWon");
  });

  it("shows the no-moves overlay when isDeadlocked", () => {
    const state = makeState({ isDeadlocked: true, shufflesLeft: 0 });
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <GameCanvas state={state} onTilePress={noop} onShufflePress={noop} onNewGamePress={noop} />
      );
    });
    expect(JSON.stringify(tree!.toJSON())).toContain("overlay.noMoves");
  });

  it("shows the shuffle CTA when no free pairs remain and shuffles are available", () => {
    // tiles=[] means hasFreePairs([]) === false; isComplete=false, shufflesLeft>0 → shuffle CTA
    const state = makeState({
      tiles: [],
      isComplete: false,
      isDeadlocked: false,
      shufflesLeft: 2,
    });
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <GameCanvas state={state} onTilePress={noop} onShufflePress={noop} onNewGamePress={noop} />
      );
    });
    // Shuffle CTA shows the noMoves key + shuffle button
    const str = JSON.stringify(tree!.toJSON());
    expect(str).toContain("overlay.noMoves");
    expect(str).toContain("overlay.shuffleButton");
  });

  it("does not show any overlay during normal play", () => {
    const state = makeState();
    let tree: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <GameCanvas state={state} onTilePress={noop} onShufflePress={noop} onNewGamePress={noop} />
      );
    });
    const str = JSON.stringify(tree!.toJSON());
    expect(str).not.toContain("overlay.youWon");
    expect(str).not.toContain("overlay.noMoves");
  });
});
