/**
 * useFruitImages — loads all fruit/planet PNG assets via Skia's useImage hook.
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

// --- Fruit icons ---
import cherryIcon from "../../assets/fruit-icons/cherry.png";
import blueberryIcon from "../../assets/fruit-icons/blueberry.png";
import lemonIcon from "../../assets/fruit-icons/lemon.png";
import grapesIcon from "../../assets/fruit-icons/grapes.png";
import orangeIcon from "../../assets/fruit-icons/orange.png";
import appleIcon from "../../assets/fruit-icons/apple.png";
import peachIcon from "../../assets/fruit-icons/peach.png";
import coconutIcon from "../../assets/fruit-icons/coconut.png";
import dragonfruitIcon from "../../assets/fruit-icons/dragonfruit.png";
import pineappleIcon from "../../assets/fruit-icons/pineapple.png";
import watermelonIcon from "../../assets/fruit-icons/watermelon.png";

// --- Celestial icons ---
import moonIcon from "../../assets/celestial-icons/moon.png";
import plutoIcon from "../../assets/celestial-icons/pluto.png";
import mercuryIcon from "../../assets/celestial-icons/mercury.png";
import marsIcon from "../../assets/celestial-icons/mars.png";
import venusIcon from "../../assets/celestial-icons/venus.png";
import earthIcon from "../../assets/celestial-icons/earth.png";
import neptuneIcon from "../../assets/celestial-icons/neptune.png";
import uranusIcon from "../../assets/celestial-icons/uranus.png";
import saturnIcon from "../../assets/celestial-icons/saturn.png";
import jupiterIcon from "../../assets/celestial-icons/jupiter.png";
import sunIcon from "../../assets/celestial-icons/sun.png";

export interface FruitSetImages {
  /** Images indexed by tier (0–10). null = not yet loaded or no icon (gems). */
  fruits: (SkImage | null)[];
  planets: (SkImage | null)[];
  gems: null[];
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

  // Planet tier order: moon, pluto, mercury, mars, venus, earth,
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
    planets: [moon, pluto, mercury, mars, venus, earth, neptune, uranus, saturn, jupiter, sun],
    gems: [null, null, null, null, null, null, null, null, null, null, null],
  };
}

/** Returns the image array for the given fruit set id. */
export function getImagesForSet(allImages: FruitSetImages, setId: string): (SkImage | null)[] {
  switch (setId) {
    case "fruits":
      return allImages.fruits;
    case "planets":
      return allImages.planets;
    default:
      return allImages.gems;
  }
}
