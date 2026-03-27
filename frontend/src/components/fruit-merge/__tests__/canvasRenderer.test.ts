/**
 * Fruit rendering logic — Skia-based implementation
 *
 * The HTML Canvas renderer (canvasRenderer.ts) has been replaced by the
 * FruitBodySkia component embedded in GameCanvas.tsx, which renders via
 * @shopify/react-native-skia.
 *
 * Rendering behaviour is now verified via the FruitMergeScreen integration
 * tests (FruitMergeScreen.test.tsx), which mount the full component tree and
 * assert on game events (merges, score, game-over) rather than on low-level
 * canvas draw calls.
 *
 * This file is intentionally kept as a placeholder so the existing test file
 * path does not become a dangling import reference in any CI config.
 */

describe("fruit rendering (Skia)", () => {
  it("rendering is covered by FruitMergeScreen integration tests", () => {
    // No unit-testable imperative draw calls remain — Skia rendering is
    // declarative JSX and is validated at the component-tree level.
    expect(true).toBe(true);
  });
});
