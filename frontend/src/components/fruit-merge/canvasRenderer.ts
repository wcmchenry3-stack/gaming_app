import { FruitDefinition } from "../../theme/fruitSets";

/**
 * Draw a single fruit body onto the canvas.
 *
 * When a loaded image is supplied, the canvas is clipped to the circle path
 * and the image is drawn at full diameter — no solid-color fill behind it and
 * no rectangular corners visible (eliminates the "box inside circle" artefact).
 *
 * Falls back to a filled circle + emoji for gems (no icon) and for any frame
 * where the image has not yet finished loading.
 */
export function drawFruitBody(
  ctx: CanvasRenderingContext2D,
  def: FruitDefinition,
  x: number,
  y: number,
  radius: number,
  image: HTMLImageElement | null
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  if (image?.complete && image.naturalWidth > 0) {
    ctx.clip(); // restrict subsequent drawing to the circle boundary
    try {
      ctx.drawImage(image, x - radius, y - radius, radius * 2, radius * 2);
      ctx.restore();
      return;
    } catch {
      // Image entered the broken state between load check and draw — fall through
    }
  }

  // No image, not yet loaded, or broken: filled circle + emoji
  ctx.fillStyle = def.color;
  ctx.fill();
  ctx.font = `${Math.round(radius * 1.1)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def.emoji, x, y);
  ctx.restore();
}
