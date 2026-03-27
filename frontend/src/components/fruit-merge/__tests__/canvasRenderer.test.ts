import { drawFruitBody } from "../canvasRenderer";
import { FruitDefinition } from "../../../theme/fruitSets";

const def: FruitDefinition = {
  tier: 0,
  name: "Cherry",
  emoji: "🍒",
  color: "#dc2626",
  radius: 20,
  scoreValue: 1,
};

function makeMockCtx() {
  return {
    save: jest.fn(),
    restore: jest.fn(),
    beginPath: jest.fn(),
    arc: jest.fn(),
    clip: jest.fn(),
    drawImage: jest.fn(),
    fill: jest.fn(),
    fillText: jest.fn(),
    fillStyle: "" as string,
    font: "" as string,
    textAlign: "" as string,
    textBaseline: "" as string,
  } as unknown as CanvasRenderingContext2D;
}

function loadedImage(naturalWidth = 64): HTMLImageElement {
  return { complete: true, naturalWidth } as HTMLImageElement;
}

describe("drawFruitBody", () => {
  it("draws the image at full diameter without clipping when the image is ready", () => {
    const ctx = makeMockCtx();
    const image = loadedImage();
    drawFruitBody(ctx, def, 100, 200, 20, image);

    // drawImage(image, x-r, y-r, 2r, 2r) — IMAGE_SCALE=1.0, r=20
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 80, 180, 40, 40);
    expect(ctx.clip).not.toHaveBeenCalled(); // no circle clipping
    expect(ctx.fill).not.toHaveBeenCalled(); // no solid-color fill
    expect(ctx.save).not.toHaveBeenCalled(); // no state save needed
  });

  it("draws a colored circle and emoji when image is null", () => {
    const ctx = makeMockCtx();
    drawFruitBody(ctx, def, 100, 200, 20, null);

    expect(ctx.clip).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(def.emoji, 100, 200);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("draws a colored circle and emoji when the image has not finished loading", () => {
    const ctx = makeMockCtx();
    const image = { complete: false, naturalWidth: 0 } as HTMLImageElement;
    drawFruitBody(ctx, def, 100, 200, 20, image);

    expect(ctx.clip).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(def.emoji, 100, 200);
  });

  it("falls back to colored circle when drawImage throws (broken image state)", () => {
    const ctx = makeMockCtx();
    (ctx.drawImage as jest.Mock).mockImplementation(() => {
      throw new Error("broken image");
    });
    drawFruitBody(ctx, def, 100, 200, 20, loadedImage());

    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(def.emoji, 100, 200);
  });

  it("does not call save/restore when drawing an image (no state changes)", () => {
    const ctx = makeMockCtx();
    drawFruitBody(ctx, def, 100, 200, 20, loadedImage());
    expect(ctx.save).not.toHaveBeenCalled();
    expect(ctx.restore).not.toHaveBeenCalled();
  });

  it("wraps the fallback circle in save/restore to isolate state changes", () => {
    const ctx = makeMockCtx();
    drawFruitBody(ctx, def, 100, 200, 20, null);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
