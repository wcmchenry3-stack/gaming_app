import { FruitDefinition } from "../../theme/fruitSets";

// The PNG assets have transparent padding around the fruit content —
// the visible fruit occupies roughly 65–80% of the image dimensions.
// Drawing at 1× would leave visible gaps between touching fruits.
// Scaling up to IMAGE_SCALE fills the physics-circle boundary with the
// actual fruit, so fruits visually touch when their physics bodies touch.
// The ctx.clip() call keeps everything inside the circle regardless of scale.
const IMAGE_SCALE = 1.25;

/**
 * Draw a single fruit body onto the canvas.
 *
 * When a loaded image is supplied the canvas is clipped to the circle path
 * and the image is drawn at IMAGE_SCALE × diameter so the actual fruit
 * content (not transparent padding) fills the physics boundary, making
 * fruits appear to touch when their physics bodies meet.
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
  image: HTMLImageElement | null
): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);

  if (image?.complete && image.naturalWidth > 0) {
    ctx.clip(); // restrict subsequent drawing to the circle boundary
    try {
      const drawR = radius * IMAGE_SCALE;
      ctx.drawImage(image, x - drawR, y - drawR, drawR * 2, drawR * 2);
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
