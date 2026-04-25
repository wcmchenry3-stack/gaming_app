/**
 * Tests for CascadeGame tap/cooldown/restart logic.
 *
 * GameCanvas (which uses HTMLCanvas + Matter.js) is mocked out entirely.
 * We focus on the state and ref logic in CascadeGame:
 *   - score starts at 0
 *   - handleTap cooldown blocks double-drops within 200ms
 *   - handleTap is blocked when game is over
 *   - handleRestart resets score and calls canvas.reset
 */

import React from "react";
import { act, create } from "react-test-renderer";
import CascadeScreen from "../CascadeScreen";
import { CascadeScoreboardProvider } from "../../game/cascade/CascadeScoreboardContext";

jest.mock("expo-blur", () => ({
  BlurView: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    popToTop: jest.fn(),
    goBack: jest.fn(),
    navigate: jest.fn(),
  }),
}));

jest.mock("../../components/cascade/FruitGlyph", () => "FruitGlyph");
jest.mock("../../components/cascade/NextFruitPreview", () => "NextFruitPreview");
jest.mock("../../components/cascade/ThemeSelector", () => "ThemeSelector");

// Skia requires a native module — mock the whole package in Jest
jest.mock("@shopify/react-native-skia", () => ({}));

// ---------------------------------------------------------------------------
// Mock gameEventClient — record every call for #371 instrumentation tests
// ---------------------------------------------------------------------------
type EnqueueArgs = [string, { type: string; data: Record<string, unknown> }];
type CompleteArgs = [string, Record<string, unknown>, Record<string, unknown>];
type StartArgs = [string, Record<string, unknown>?, Record<string, unknown>?];
const mockStartGame = jest.fn() as unknown as jest.Mock<string, StartArgs>;
const mockEnqueueEvent = jest.fn() as unknown as jest.Mock<undefined, EnqueueArgs>;
const mockCompleteGame = jest.fn() as unknown as jest.Mock<undefined, CompleteArgs>;
jest.mock("../../game/_shared/gameEventClient", () => ({
  gameEventClient: {
    startGame: (...args: unknown[]) => (mockStartGame as unknown as jest.Mock)(...args),
    enqueueEvent: (...args: unknown[]) => (mockEnqueueEvent as unknown as jest.Mock)(...args),
    completeGame: (...args: unknown[]) => (mockCompleteGame as unknown as jest.Mock)(...args),
    init: jest.fn().mockResolvedValue(undefined),
    reportBug: jest.fn(),
    getQueueStats: jest.fn(),
    clearAll: jest.fn().mockResolvedValue(undefined),
  },
}));

// ---------------------------------------------------------------------------
// Mock GameCanvas — forwardRef component that exposes drop/reset spies
// ---------------------------------------------------------------------------

const mockDrop = jest.fn();
const mockReset = jest.fn();

jest.mock("../../components/cascade/GameCanvas", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactMod = require("react");
  const MockCanvas = ReactMod.forwardRef(
    (
      props: {
        onTap: (x: number) => void;
        onMerge: (e: { tier: number; x: number; y: number }) => void;
        onGameOver: () => void;
      },
      ref: unknown
    ) => {
      ReactMod.useImperativeHandle(ref, () => ({
        drop: mockDrop,
        reset: mockReset,
        announceEvent: jest.fn(),
      }));
      // Expose callbacks as data-* props on a View so tests can reach them
      return ReactMod.createElement("View", {
        testID: "mock-canvas",
        onTouchEnd: () => props.onTap(150),
        __onTap: props.onTap,
        __onMerge: props.onMerge,
        __onGameOver: props.onGameOver,
      });
    }
  );
  MockCanvas.displayName = "MockGameCanvas";
  return MockCanvas;
});

// Mock navigation
const mockNavigation = { goBack: jest.fn() } as unknown as Parameters<
  typeof CascadeScreen
>[0]["navigation"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderScreen() {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(
      <CascadeScoreboardProvider>
        <CascadeScreen navigation={mockNavigation} />
      </CascadeScoreboardProvider>
    );
  });

  // Trigger onLayout so the canvas renders (containerWidth/canvasHeight default to 0)
  act(() => {
    const outer = renderer.root.findAll((node) => node.props.onLayout !== undefined)[0];
    outer.props.onLayout({
      nativeEvent: { layout: { width: 300, height: 600 } },
    });
  });

  return renderer;
}

/** Find the mock canvas node by testID */
function findCanvas(renderer: ReturnType<typeof create>) {
  return renderer.root.findAll((node) => node.props.testID === "mock-canvas")[0];
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.useFakeTimers();
  mockDrop.mockClear();
  mockReset.mockClear();
  mockStartGame.mockReset();
  mockStartGame.mockReturnValue("game-uuid-test");
  mockEnqueueEvent.mockReset();
  mockCompleteGame.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CascadeGame", () => {
  it("score starts at 0", () => {
    const renderer = renderScreen();
    expect(JSON.stringify(renderer.toJSON())).toContain('"0"');
  });

  it("handleTap calls canvas.drop once", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);

    act(() => {
      canvas.props.__onTap(150);
    });

    expect(mockDrop).toHaveBeenCalledTimes(1);
  });

  it("second tap within 200ms cooldown is ignored", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);

    act(() => {
      canvas.props.__onTap(150);
      canvas.props.__onTap(150); // immediate second tap
    });

    expect(mockDrop).toHaveBeenCalledTimes(1);
  });

  it("tap succeeds again after the 200ms cooldown expires", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);

    act(() => {
      canvas.props.__onTap(150);
    });
    act(() => {
      jest.advanceTimersByTime(201);
    });
    act(() => {
      canvas.props.__onTap(150);
    });

    expect(mockDrop).toHaveBeenCalledTimes(2);
  });

  it("tap after game over is ignored", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);

    act(() => {
      canvas.props.__onGameOver();
    });
    act(() => {
      canvas.props.__onTap(150);
    });

    expect(mockDrop).not.toHaveBeenCalled();
  });

  it("handleRestart resets score and calls canvas.reset", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);

    // Add some score via onMerge then trigger game over
    act(() => {
      canvas.props.__onMerge({ tier: 2, x: 150, y: 300 }); // scoreForMerge(2) = 8
      canvas.props.__onGameOver();
    });

    // Call onRestart directly via GameOverOverlay's prop (avoids traversing Modal internals)
    const overlay = renderer.root.findAll((node) => typeof node.props.onRestart === "function")[0];

    act(() => {
      overlay.props.onRestart();
    });

    expect(mockReset).toHaveBeenCalledTimes(1);
    // Score resets to 0
    expect(JSON.stringify(renderer.toJSON())).toContain('"0"');
  });
});

// ---------------------------------------------------------------------------
// #371 — gameEventClient instrumentation
// ---------------------------------------------------------------------------

const RESERVED_KEYS = ["game_id", "event_index", "event_type"];

describe("CascadeScreen — gameEventClient instrumentation (#371)", () => {
  it("calls startGame('cascade') with fruit_set/theme on mount", () => {
    renderScreen();
    expect(mockStartGame).toHaveBeenCalledTimes(1);
    const startCall = mockStartGame.mock.calls[0];
    if (startCall === undefined) throw new Error("Expected startGame call");
    const [gameType, meta, eventData] = startCall;
    expect(gameType).toBe("cascade");
    expect(meta).toEqual({});
    expect(eventData).toEqual(
      expect.objectContaining({
        fruit_set: expect.any(String),
        theme: expect.any(String),
        seed: null,
      })
    );
    for (const key of RESERVED_KEYS) {
      expect(eventData).not.toHaveProperty(key);
    }
  });

  it("emits a 'drop' event with expected payload shape on each tap", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    mockEnqueueEvent.mockClear();
    act(() => {
      canvas.props.__onTap(123);
    });
    const dropCall = mockEnqueueEvent.mock.calls.find((c) => c[1]?.type === "drop");
    expect(dropCall).toBeDefined();
    const [gameId, event] = dropCall!;
    expect(gameId).toBe("game-uuid-test");
    expect(event.data).toEqual(
      expect.objectContaining({
        drop_index: 1,
        fruit_tier: expect.any(Number),
        x: 123,
        score_before: 0,
      })
    );
    for (const key of RESERVED_KEYS) {
      expect(event.data).not.toHaveProperty(key);
    }
  });

  it("emits a 'merge' event with from_tier/to_tier and x/y", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    mockEnqueueEvent.mockClear();
    act(() => {
      canvas.props.__onMerge({ tier: 4, x: 200, y: 300 });
    });
    const mergeCall = mockEnqueueEvent.mock.calls.find((c) => c[1]?.type === "merge");
    expect(mergeCall).toBeDefined();
    expect(mergeCall![1].data).toEqual(
      expect.objectContaining({
        from_tier: 3,
        to_tier: 4,
        x: 200,
        y: 300,
        score_after: expect.any(Number),
      })
    );
    for (const key of RESERVED_KEYS) {
      expect(mergeCall![1].data).not.toHaveProperty(key);
    }
  });

  it("capture ordering: drops emit in tap order", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    mockEnqueueEvent.mockClear();
    act(() => {
      canvas.props.__onTap(50);
    });
    act(() => {
      jest.advanceTimersByTime(201);
    });
    act(() => {
      canvas.props.__onTap(250);
    });
    const drops = mockEnqueueEvent.mock.calls.map((c) => c[1]).filter((e) => e?.type === "drop");
    expect(drops.length).toBe(2);
    expect(drops[0]?.data.drop_index).toBe(1);
    expect(drops[1]?.data.drop_index).toBe(2);
    expect(drops[0]?.data.x).toBe(50);
    expect(drops[1]?.data.x).toBe(250);
  });

  it("fires completeGame with snake_case payload on handleGameOver", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    // Drop once and merge once so total_drops/total_merges are non-zero.
    act(() => {
      canvas.props.__onTap(100);
    });
    act(() => {
      canvas.props.__onMerge({ tier: 3, x: 100, y: 200 });
    });
    mockCompleteGame.mockClear();
    act(() => {
      canvas.props.__onGameOver();
    });
    expect(mockCompleteGame).toHaveBeenCalledTimes(1);
    const completeCall = mockCompleteGame.mock.calls[0];
    if (completeCall === undefined) throw new Error("Expected completeGame call");
    const [, summary, eventData] = completeCall;
    expect(summary.outcome).toBe("completed");
    expect(eventData).toEqual(
      expect.objectContaining({
        final_score: expect.any(Number),
        duration_ms: expect.any(Number),
        theme: expect.any(String),
        total_drops: 1,
        total_merges: 1,
        outcome: "completed",
      })
    );
    for (const key of RESERVED_KEYS) {
      expect(eventData).not.toHaveProperty(key);
    }
  });

  it("does not emit drop or merge events after game_over", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    act(() => {
      canvas.props.__onGameOver();
    });
    mockEnqueueEvent.mockClear();
    act(() => {
      canvas.props.__onTap(100);
      canvas.props.__onMerge({ tier: 2, x: 50, y: 50 });
    });
    // handleTap early-returns on gameOver; handleMerge runs but completedRef
    // blocks enqueueEvent.
    const postDrops = mockEnqueueEvent.mock.calls.filter((c) => c[1]?.type === "drop");
    const postMerges = mockEnqueueEvent.mock.calls.filter((c) => c[1]?.type === "merge");
    expect(postDrops).toHaveLength(0);
    expect(postMerges).toHaveLength(0);
  });

  it("does not double-fire game_ended when handleGameOver runs after completion", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    act(() => {
      canvas.props.__onGameOver();
    });
    mockCompleteGame.mockClear();
    act(() => {
      canvas.props.__onGameOver();
    });
    expect(mockCompleteGame).not.toHaveBeenCalled();
  });

  it("Restart abandons/completes the old session and starts a new one", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    act(() => {
      canvas.props.__onMerge({ tier: 2, x: 150, y: 300 });
      canvas.props.__onGameOver();
    });
    mockStartGame.mockClear();
    mockStartGame.mockReturnValue("game-uuid-test-2");
    mockCompleteGame.mockClear();
    const overlay = renderer.root.findAll((node) => typeof node.props.onRestart === "function")[0];
    act(() => {
      overlay.props.onRestart();
    });
    // The previous session already completed on handleGameOver, so restart
    // should NOT re-fire completeGame for it — completedRef guards this.
    expect(mockCompleteGame).not.toHaveBeenCalled();
    // But a fresh session must be opened.
    expect(mockStartGame).toHaveBeenCalledWith(
      "cascade",
      {},
      expect.objectContaining({ fruit_set: expect.any(String) })
    );
  });

  it("fires abandoned on unmount mid-game", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    act(() => {
      canvas.props.__onTap(100);
    });
    mockCompleteGame.mockClear();
    act(() => {
      renderer.unmount();
    });
    expect(mockCompleteGame).toHaveBeenCalledTimes(1);
    expect(mockCompleteGame.mock.calls[0]?.[1]?.outcome).toBe("abandoned");
  });

  it("client failures do not block gameplay (enqueueEvent throws)", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);
    mockEnqueueEvent.mockImplementation(() => {
      throw new Error("boom");
    });
    expect(() => {
      act(() => {
        canvas.props.__onTap(150);
      });
    }).not.toThrow();
    // canvas.drop still called despite the throw
    expect(mockDrop).toHaveBeenCalled();
    mockEnqueueEvent.mockReset();
  });
});
