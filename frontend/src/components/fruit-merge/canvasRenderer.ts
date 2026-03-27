import { FruitDefinition } from "../../theme/fruitSets";

// Draw at 1× diameter — transparent PNG padding shows the canvas background naturally,
// allowing non-circular fruits (grapes, pineapple, cherry) to render in their actual shape.
const IMAGE_SCALE = 1.0;

/**
 * Draw a single fruit body onto the canvas.
 *
 * When a loaded image is supplied, a circle matching the physics body is first
 * filled with binBackground so that transparent areas of the PNG (e.g. gaps
 * between grapes, the leaf on a pineapple) show the bin color rather than
 * whatever fruit happens to be behind them. The PNG is then drawn on top.
 *
 * Falls back to a filled circle + emoji for gems (no icon) and for any
 * frame where the image has not yet finished loading.
 */
export function drawFruitBody(
  ctx: CanvasRenderingContext2D,
  def: FruitDefinition,
  x: number,
  y: number,
  radius: number,
  image: HTMLImageElement | null,
  binBackground: string
): void {
  if (image?.complete && image.naturalWidth > 0) {
    try {
      // Fill the physics-circle with the bin background first so transparent
      // PNG pixels show the bin color, not whatever fruit is behind this one.
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = binBackground;
      ctx.fill();
      ctx.restore();

      const drawR = radius * IMAGE_SCALE;
      ctx.drawImage(image, x - drawR, y - drawR, drawR * 2, drawR * 2);
      return;
    } catch {
      // Image entered the broken state between load check and draw — fall through
    }
  }

  // No image, not yet loaded, or broken: filled circle + emoji
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.font = `${Math.round(radius * 1.1)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def.emoji, x, y);
  ctx.restore();
}
