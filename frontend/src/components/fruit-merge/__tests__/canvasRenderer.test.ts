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

const BIN_BG = "#0f172a";

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
  it("fills a background circle then draws the image without clipping when image is ready", () => {
    const ctx = makeMockCtx();
    const image = loadedImage();
    drawFruitBody(ctx, def, 100, 200, 20, image, BIN_BG);

    // Background circle filled first so transparent PNG areas show the bin color
    expect(ctx.arc).toHaveBeenCalledWith(100, 200, 20, 0, Math.PI * 2);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    // PNG drawn at IMAGE_SCALE=1.0: x-r=80, y-r=180, 2r=40
    expect(ctx.drawImage).toHaveBeenCalledWith(image, 80, 180, 40, 40);
    expect(ctx.clip).not.toHaveBeenCalled();
  });

  it("draws a colored circle and emoji when image is null", () => {
    const ctx = makeMockCtx();
    drawFruitBody(ctx, def, 100, 200, 20, null, BIN_BG);

    expect(ctx.clip).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(def.emoji, 100, 200);
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("draws a colored circle and emoji when the image has not finished loading", () => {
    const ctx = makeMockCtx();
    const image = { complete: false, naturalWidth: 0 } as HTMLImageElement;
    drawFruitBody(ctx, def, 100, 200, 20, image, BIN_BG);

    expect(ctx.clip).not.toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(def.emoji, 100, 200);
  });

  it("falls back to colored circle when drawImage throws (broken image state)", () => {
    const ctx = makeMockCtx();
    (ctx.drawImage as jest.Mock).mockImplementation(() => {
      throw new Error("broken image");
    });
    drawFruitBody(ctx, def, 100, 200, 20, loadedImage(), BIN_BG);

    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(def.emoji, 100, 200);
  });

  it("wraps the background fill in save/restore to isolate state changes", () => {
    const ctx = makeMockCtx();
    drawFruitBody(ctx, def, 100, 200, 20, loadedImage(), BIN_BG);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it("wraps the fallback circle in save/restore to isolate state changes", () => {
    const ctx = makeMockCtx();
    drawFruitBody(ctx, def, 100, 200, 20, null, BIN_BG);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
