/**
 * Tests for FruitMergeGame tap/cooldown/restart logic.
 *
 * GameCanvas (which uses HTMLCanvas + Matter.js) is mocked out entirely.
 * We focus on the state and ref logic in FruitMergeGame:
 *   - score starts at 0
 *   - handleTap cooldown blocks double-drops within 400ms
 *   - handleTap is blocked when game is over
 *   - handleRestart resets score and calls canvas.reset
 */

import React from "react";
import { act, create } from "react-test-renderer";
import FruitMergeScreen from "../FruitMergeScreen";

jest.mock("../../components/fruit-merge/FruitGlyph", () => "FruitGlyph");
jest.mock("../../components/fruit-merge/NextFruitPreview", () => "NextFruitPreview");
jest.mock("../../components/fruit-merge/ThemeSelector", () => "ThemeSelector");

// Skia requires a native module — mock the whole package in Jest
jest.mock("@shopify/react-native-skia", () => ({}));

// useFruitImages calls useImage (Skia) — return null images for all tiers
jest.mock("../../theme/useFruitImages", () => ({
  useFruitImages: () => ({
    fruits: Array(11).fill(null),
    planets: Array(11).fill(null),
    gems: Array(11).fill(null),
  }),
  getImagesForSet: () => Array(11).fill(null),
}));

// ---------------------------------------------------------------------------
// Mock GameCanvas — forwardRef component that exposes drop/reset spies
// ---------------------------------------------------------------------------

const mockDrop = jest.fn();
const mockReset = jest.fn();

jest.mock("../../components/fruit-merge/GameCanvas", () => {
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
  typeof FruitMergeScreen
>[0]["navigation"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderScreen() {
  let renderer!: ReturnType<typeof create>;
  act(() => {
    renderer = create(<FruitMergeScreen navigation={mockNavigation} />);
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
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FruitMergeGame", () => {
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

  it("second tap within 400ms cooldown is ignored", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);

    act(() => {
      canvas.props.__onTap(150);
      canvas.props.__onTap(150); // immediate second tap
    });

    expect(mockDrop).toHaveBeenCalledTimes(1);
  });

  it("tap succeeds again after the 400ms cooldown expires", () => {
    const renderer = renderScreen();
    const canvas = findCanvas(renderer);

    act(() => {
      canvas.props.__onTap(150);
    });
    act(() => {
      jest.advanceTimersByTime(401);
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
