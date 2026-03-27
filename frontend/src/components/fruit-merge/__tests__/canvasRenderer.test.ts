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
  it("clips to the circle and draws the image at full diameter when the image is ready", () => {
    const ctx = makeMockCtx();
    const image = loadedImage();
    drawFruitBody(ctx, def, 100, 200, 20, image);

    expect(ctx.arc).toHaveBeenCalledWith(100, 200, 20, 0, Math.PI * 2);
    expect(ctx.clip).toHaveBeenCalled();
    // drawn at IMAGE_SCALE (1.25) × diameter: drawR = 25, so x-drawR=75, y-drawR=175, size=50
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 75, 175, 50, 50);
    expect(ctx.fill).not.toHaveBeenCalled(); // no solid-color fill under the image
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

  it("always wraps drawing in save/restore", () => {
    const ctx = makeMockCtx();
    drawFruitBody(ctx, def, 100, 200, 20, null);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
