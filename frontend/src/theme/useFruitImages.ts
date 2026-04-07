/**
 * useFruitImages — loads all fruit/cosmos PNG assets via Skia's useImage hook.
 *
 * useImage must be called unconditionally (React hooks rules), so every asset is
 * loaded upfront regardless of the active fruit set. The caller picks the right
 * array based on fruitSet.id.
 *
 * Returns null for each slot while the image is still decoding; the renderer
 * falls back to a coloured circle in that case.
 */
import { useImage } from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";

// --- Baked fruit icons (pre-composited, clipped — for game canvas rendering) ---
import cherryIcon from "../../assets/fruits-baked/cherry.png";
import blueberryIcon from "../../assets/fruits-baked/blueberry.png";
import lemonIcon from "../../assets/fruits-baked/lemon.png";
import grapesIcon from "../../assets/fruits-baked/grapes.png";
import orangeIcon from "../../assets/fruits-baked/orange.png";
import appleIcon from "../../assets/fruits-baked/apple.png";
import peachIcon from "../../assets/fruits-baked/peach.png";
import coconutIcon from "../../assets/fruits-baked/coconut.png";
import dragonfruitIcon from "../../assets/fruits-baked/dragonfruit.png";
import pineappleIcon from "../../assets/fruits-baked/pineapple.png";
import watermelonIcon from "../../assets/fruits-baked/watermelon.png";

// --- Baked celestial icons ---
import moonIcon from "../../assets/cosmos-baked/moon.png";
import plutoIcon from "../../assets/cosmos-baked/pluto.png";
import mercuryIcon from "../../assets/cosmos-baked/mercury.png";
import marsIcon from "../../assets/cosmos-baked/mars.png";
import venusIcon from "../../assets/cosmos-baked/venus.png";
import earthIcon from "../../assets/cosmos-baked/earth.png";
import neptuneIcon from "../../assets/cosmos-baked/neptune.png";
import uranusIcon from "../../assets/cosmos-baked/uranus.png";
import saturnIcon from "../../assets/cosmos-baked/saturn.png";
import jupiterIcon from "../../assets/cosmos-baked/jupiter.png";
import sunIcon from "../../assets/cosmos-baked/sun.png";

export interface FruitSetImages {
  /** Images indexed by tier (0–10). null = not yet loaded. */
  fruits: (SkImage | null)[];
  cosmos: (SkImage | null)[];
}

export function useFruitImages(): FruitSetImages {
  // Fruit tier order: cherry, blueberry, lemon, grape, orange, apple,
  //                   peach, coconut, dragonfruit, pineapple, watermelon
  const cherry = useImage(cherryIcon);
  const blueberry = useImage(blueberryIcon);
  const lemon = useImage(lemonIcon);
  const grape = useImage(grapesIcon);
  const orange = useImage(orangeIcon);
  const apple = useImage(appleIcon);
  const peach = useImage(peachIcon);
  const coconut = useImage(coconutIcon);
  const dragonfruit = useImage(dragonfruitIcon);
  const pineapple = useImage(pineappleIcon);
  const watermelon = useImage(watermelonIcon);

  // Cosmos tier order: moon, pluto, mercury, mars, venus, earth,
  //                    neptune, uranus, saturn, jupiter, sun
  const moon = useImage(moonIcon);
  const pluto = useImage(plutoIcon);
  const mercury = useImage(mercuryIcon);
  const mars = useImage(marsIcon);
  const venus = useImage(venusIcon);
  const earth = useImage(earthIcon);
  const neptune = useImage(neptuneIcon);
  const uranus = useImage(uranusIcon);
  const saturn = useImage(saturnIcon);
  const jupiter = useImage(jupiterIcon);
  const sun = useImage(sunIcon);

  return {
    fruits: [
      cherry,
      blueberry,
      lemon,
      grape,
      orange,
      apple,
      peach,
      coconut,
      dragonfruit,
      pineapple,
      watermelon,
    ],
    cosmos: [moon, pluto, mercury, mars, venus, earth, neptune, uranus, saturn, jupiter, sun],
  };
}

/** Returns the image array for the given fruit set id. */
export function getImagesForSet(allImages: FruitSetImages, setId: string): (SkImage | null)[] {
  switch (setId) {
    case "fruits":
      return allImages.fruits;
    case "cosmos":
      return allImages.cosmos;
    default:
      return allImages.fruits;
  }
}
