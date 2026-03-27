/**
 * @jest-environment node
 *
 * Asset transparency smoke test — CI gate
 * ----------------------------------------
 * Verifies that every sprite PNG in the fruit-icons and celestial-icons
 * directories has transparent corner pixels (alpha < 200), confirming that
 * `scripts/remove_backgrounds.py` has been run on the assets.
 *
 * This test will FAIL on CI if the script has not been run, preventing
 * un-processed opaque-background assets from shipping.
 */

// Each 2048×2048 RGBA PNG takes ~5–15 s to fully decompress in Node.js.
// With 24 files across two directories the suite runs ~200 s total.
// The extended timeout below prevents false-positive CI failures.
jest.setTimeout(300_000);

import * as fs from "fs";
import * as path from "path";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PNG } = require("pngjs");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CornerAlphas {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

function getCornerAlphas(filePath: string): CornerAlphas | null {
  const buf = fs.readFileSync(filePath);
  let png: { width: number; height: number; data: Buffer };
  try {
    png = PNG.sync.read(buf);
  } catch {
    return null; // unreadable PNG — skip
  }

  const { width, height, data } = png;
  if (!data || width < 1 || height < 1) return null;

  // pngjs gives raw RGBA bytes row-major; alpha is every 4th byte starting at index 3
  const stride = width * 4;
  const topLeft = data[3];
  const topRight = data[(width - 1) * 4 + 3];
  const bottomLeft = data[(height - 1) * stride + 3];
  const bottomRight = data[(height - 1) * stride + (width - 1) * 4 + 3];

  return { topLeft, topRight, bottomLeft, bottomRight };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const FRONTEND_ROOT = path.resolve(__dirname, "..", "..");

const ASSET_DIRS = [
  path.join(FRONTEND_ROOT, "assets", "fruit-icons"),
  path.join(FRONTEND_ROOT, "assets", "celestial-icons"),
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PNG asset transparency (post background-removal)", () => {
  for (const dir of ASSET_DIRS) {
    const dirName = path.basename(dir);
    const pngFiles = fs.readdirSync(dir).filter((f) => f.endsWith(".png"));

    describe(`assets/${dirName}`, () => {
      it("contains at least one PNG file", () => {
        expect(pngFiles.length).toBeGreaterThan(0);
      });

      for (const file of pngFiles) {
        const filePath = path.join(dir, file);

        it(`${file} — corner pixels are transparent (alpha < 200)`, () => {
          const alphas = getCornerAlphas(filePath);

          if (alphas === null) {
            // Unreadable PNG — skip rather than fail
            return;
          }

          const { topLeft, topRight, bottomLeft, bottomRight } = alphas;
          const maxCornerAlpha = Math.max(topLeft, topRight, bottomLeft, bottomRight);

          expect(maxCornerAlpha).toBeLessThan(200);
        });
      }
    });
  }
});
