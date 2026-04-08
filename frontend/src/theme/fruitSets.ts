import { ImageSourcePropType } from "react-native";

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
import pumpkinIcon from "../../assets/fruit-icons/pumpkin.png"; // reserved for future use
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
import milkyWayIcon from "../../assets/celestial-icons/milkyway.png"; // reserved for future use

// Pre-baked game canvas icons — composited, clipped, ready for single drawImage
import cherryBaked from "../../assets/fruits-baked/cherry.png";
import blueberryBaked from "../../assets/fruits-baked/blueberry.png";
import lemonBaked from "../../assets/fruits-baked/lemon.png";
import grapesBaked from "../../assets/fruits-baked/grapes.png";
import orangeBaked from "../../assets/fruits-baked/orange.png";
import appleBaked from "../../assets/fruits-baked/apple.png";
import peachBaked from "../../assets/fruits-baked/peach.png";
import coconutBaked from "../../assets/fruits-baked/coconut.png";
import dragonfruitBaked from "../../assets/fruits-baked/dragonfruit.png";
import pineappleBaked from "../../assets/fruits-baked/pineapple.png";
import watermelonBaked from "../../assets/fruits-baked/watermelon.png";
import pumpkinBaked from "../../assets/fruits-baked/pumpkin.png"; // reserved for future use
import moonBaked from "../../assets/cosmos-baked/moon.png";
import plutoBaked from "../../assets/cosmos-baked/pluto.png";
import mercuryBaked from "../../assets/cosmos-baked/mercury.png";
import marsBaked from "../../assets/cosmos-baked/mars.png";
import venusBaked from "../../assets/cosmos-baked/venus.png";
import earthBaked from "../../assets/cosmos-baked/earth.png";
import neptuneBaked from "../../assets/cosmos-baked/neptune.png";
import uranusBaked from "../../assets/cosmos-baked/uranus.png";
import saturnBaked from "../../assets/cosmos-baked/saturn.png";
import jupiterBaked from "../../assets/cosmos-baked/jupiter.png";
import sunBaked from "../../assets/cosmos-baked/sun.png";
import milkyWayBaked from "../../assets/cosmos-baked/milkyway.png"; // reserved for future use

export type FruitTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface FruitDefinition {
  tier: FruitTier;
  name: string;
  nameKey?: string; // JSON vertex-lookup key when it differs from name.toLowerCase()
  emoji: string;
  icon?: ImageSourcePropType;
  /** Pre-baked game canvas PNG — composited, clipped, ready for a single drawImage. */
  bakedIcon?: ImageSourcePropType;
  /**
   * Normalised clip radius of the baked PNG (= clipR / physics radius).
   * At render time: half-size = bakedClipR * def.radius
   * Produced by scripts/bake_sprites.py — do not edit by hand.
   */
  bakedClipR?: number;
  color: string;
  radius: number; // physics radius in px — identical across all sets per tier
  scoreValue: number; // points awarded on merge
}

export interface FruitSet {
  id: string;
  label: string;
  fruits: FruitDefinition[];
}

// Radii scale with tier — same across all sets so physics is skin-agnostic
const RADII: Record<FruitTier, number> = {
  0: 18,
  1: 25,
  2: 33,
  3: 38,
  4: 44,
  5: 52,
  6: 60,
  7: 68,
  8: 76,
  9: 86,
  10: 98,
};

// Score doubles each tier (cherry merge = 1, watermelon merge = 1024)
const SCORE_VALUES: Record<FruitTier, number> = {
  0: 1,
  1: 2,
  2: 4,
  3: 8,
  4: 16,
  5: 32,
  6: 64,
  7: 128,
  8: 256,
  9: 512,
  10: 1024,
};

const FRUIT_ICONS = {
  cherry: cherryIcon,
  blueberry: blueberryIcon,
  lemon: lemonIcon,
  grape: grapesIcon,
  orange: orangeIcon,
  apple: appleIcon,
  peach: peachIcon,
  coconut: coconutIcon,
  dragonfruit: dragonfruitIcon,
  pineapple: pineappleIcon,
  watermelon: watermelonIcon,
  pumpkin: pumpkinIcon,
} as const;

const COSMOS_ICONS = {
  moon: moonIcon,
  pluto: plutoIcon,
  mercury: mercuryIcon,
  mars: marsIcon,
  venus: venusIcon,
  earth: earthIcon,
  neptune: neptuneIcon,
  uranus: uranusIcon,
  saturn: saturnIcon,
  jupiter: jupiterIcon,
  sun: sunIcon,
  milkyWay: milkyWayIcon,
} as const;

// Baked game-canvas icons (produced by scripts/bake_sprites.py)
const FRUIT_BAKED = {
  cherry: cherryBaked,
  blueberry: blueberryBaked,
  lemon: lemonBaked,
  grape: grapesBaked,
  orange: orangeBaked,
  apple: appleBaked,
  peach: peachBaked,
  coconut: coconutBaked,
  dragonfruit: dragonfruitBaked,
  pineapple: pineappleBaked,
  watermelon: watermelonBaked,
  pumpkin: pumpkinBaked,
} as const;

const COSMOS_BAKED = {
  moon: moonBaked,
  pluto: plutoBaked,
  mercury: mercuryBaked,
  mars: marsBaked,
  venus: venusBaked,
  earth: earthBaked,
  neptune: neptuneBaked,
  uranus: uranusBaked,
  saturn: saturnBaked,
  jupiter: jupiterBaked,
  sun: sunBaked,
  milkyWay: milkyWayBaked,
} as const;

export const FRUIT_SETS: Record<string, FruitSet> = {
  fruits: {
    id: "fruits",
    label: "Fruits",
    fruits: [
      {
        tier: 0,
        name: "Cherry",
        icon: FRUIT_ICONS.cherry,
        bakedIcon: FRUIT_BAKED.cherry,
        bakedClipR: 3.225928,
        emoji: "🍒",
        color: "#dc2626",
        radius: RADII[0],
        scoreValue: SCORE_VALUES[0],
      },
      {
        tier: 1,
        name: "Blueberry",
        icon: FRUIT_ICONS.blueberry,
        bakedIcon: FRUIT_BAKED.blueberry,
        bakedClipR: 1.518479,
        emoji: "🫐",
        color: "#6d28d9",
        radius: RADII[1],
        scoreValue: SCORE_VALUES[1],
      },
      {
        tier: 2,
        name: "Lemon",
        icon: FRUIT_ICONS.lemon,
        bakedIcon: FRUIT_BAKED.lemon,
        bakedClipR: 1.888715,
        emoji: "🍋",
        color: "#ca8a04",
        radius: RADII[2],
        scoreValue: SCORE_VALUES[2],
      },
      {
        tier: 3,
        name: "Grape",
        nameKey: "grapes", // PNG filename is grapes.png, not grape.png
        icon: FRUIT_ICONS.grape,
        bakedIcon: FRUIT_BAKED.grape,
        bakedClipR: 1.416466,
        emoji: "🍇",
        color: "#7c3aed",
        radius: RADII[3],
        scoreValue: SCORE_VALUES[3],
      },
      {
        tier: 4,
        name: "Orange",
        icon: FRUIT_ICONS.orange,
        bakedIcon: FRUIT_BAKED.orange,
        bakedClipR: 2.114153,
        emoji: "🍊",
        color: "#ea580c",
        radius: RADII[4],
        scoreValue: SCORE_VALUES[4],
      },
      {
        tier: 5,
        name: "Apple",
        icon: FRUIT_ICONS.apple,
        bakedIcon: FRUIT_BAKED.apple,
        bakedClipR: 2.091779,
        emoji: "🍎",
        color: "#dc2626",
        radius: RADII[5],
        scoreValue: SCORE_VALUES[5],
      },
      {
        tier: 6,
        name: "Peach",
        icon: FRUIT_ICONS.peach,
        bakedIcon: FRUIT_BAKED.peach,
        bakedClipR: 2.113583,
        emoji: "🍑",
        color: "#f97316",
        radius: RADII[6],
        scoreValue: SCORE_VALUES[6],
      },
      {
        tier: 7,
        name: "Coconut",
        icon: FRUIT_ICONS.coconut,
        bakedIcon: FRUIT_BAKED.coconut,
        bakedClipR: 2.053704,
        emoji: "🥥",
        color: "#78716c",
        radius: RADII[7],
        scoreValue: SCORE_VALUES[7],
      },
      {
        tier: 8,
        name: "Dragonfruit",
        icon: FRUIT_ICONS.dragonfruit,
        bakedIcon: FRUIT_BAKED.dragonfruit,
        bakedClipR: 1.88327,
        emoji: "🐉",
        color: "#db2777",
        radius: RADII[8],
        scoreValue: SCORE_VALUES[8],
      },
      {
        tier: 9,
        name: "Pineapple",
        icon: FRUIT_ICONS.pineapple,
        bakedIcon: FRUIT_BAKED.pineapple,
        bakedClipR: 1.910846,
        emoji: "🍍",
        color: "#ca8a04",
        radius: RADII[9],
        scoreValue: SCORE_VALUES[9],
      },
      {
        tier: 10,
        name: "Watermelon",
        icon: FRUIT_ICONS.watermelon,
        bakedIcon: FRUIT_BAKED.watermelon,
        bakedClipR: 1.938303,
        emoji: "🍉",
        color: "#16a34a",
        radius: RADII[10],
        scoreValue: SCORE_VALUES[10],
      },
    ],
  },
  cosmos: {
    id: "cosmos",
    label: "Cosmos",
    fruits: [
      {
        tier: 0,
        name: "Moon",
        icon: COSMOS_ICONS.moon,
        bakedIcon: COSMOS_BAKED.moon,
        bakedClipR: 2.187446,
        emoji: "🌙",
        color: "#d1d5db",
        radius: RADII[0],
        scoreValue: SCORE_VALUES[0],
      },
      {
        tier: 1,
        name: "Pluto",
        icon: COSMOS_ICONS.pluto,
        bakedIcon: COSMOS_BAKED.pluto,
        bakedClipR: 2.274817,
        emoji: "🪨",
        color: "#94a3b8",
        radius: RADII[1],
        scoreValue: SCORE_VALUES[1],
      },
      {
        tier: 2,
        name: "Mercury",
        icon: COSMOS_ICONS.mercury,
        bakedIcon: COSMOS_BAKED.mercury,
        bakedClipR: 2.186961,
        emoji: "🪨",
        color: "#9ca3af",
        radius: RADII[2],
        scoreValue: SCORE_VALUES[2],
      },
      {
        tier: 3,
        name: "Mars",
        icon: COSMOS_ICONS.mars,
        bakedIcon: COSMOS_BAKED.mars,
        bakedClipR: 2.183666,
        emoji: "🔴",
        color: "#dc2626",
        radius: RADII[3],
        scoreValue: SCORE_VALUES[3],
      },
      {
        tier: 4,
        name: "Venus",
        icon: COSMOS_ICONS.venus,
        bakedIcon: COSMOS_BAKED.venus,
        bakedClipR: 2.358557,
        emoji: "🟡",
        color: "#fbbf24",
        radius: RADII[4],
        scoreValue: SCORE_VALUES[4],
      },
      {
        tier: 5,
        name: "Earth",
        icon: COSMOS_ICONS.earth,
        bakedIcon: COSMOS_BAKED.earth,
        bakedClipR: 2.186961,
        emoji: "🌍",
        color: "#2563eb",
        radius: RADII[5],
        scoreValue: SCORE_VALUES[5],
      },
      {
        tier: 6,
        name: "Neptune",
        icon: COSMOS_ICONS.neptune,
        bakedIcon: COSMOS_BAKED.neptune,
        bakedClipR: 2.183666,
        emoji: "🔵",
        color: "#1d4ed8",
        radius: RADII[6],
        scoreValue: SCORE_VALUES[6],
      },
      {
        tier: 7,
        name: "Uranus",
        icon: COSMOS_ICONS.uranus,
        bakedIcon: COSMOS_BAKED.uranus,
        bakedClipR: 1.919211,
        emoji: "🩵",
        color: "#67e8f9",
        radius: RADII[7],
        scoreValue: SCORE_VALUES[7],
      },
      {
        tier: 8,
        name: "Saturn",
        icon: COSMOS_ICONS.saturn,
        bakedIcon: COSMOS_BAKED.saturn,
        bakedClipR: 1.680917,
        emoji: "🪐",
        color: "#ca8a04",
        radius: RADII[8],
        scoreValue: SCORE_VALUES[8],
      },
      {
        tier: 9,
        name: "Jupiter",
        icon: COSMOS_ICONS.jupiter,
        bakedIcon: COSMOS_BAKED.jupiter,
        bakedClipR: 1.509313,
        emoji: "🟠",
        color: "#ea580c",
        radius: RADII[9],
        scoreValue: SCORE_VALUES[9],
      },
      {
        tier: 10,
        name: "Sun",
        icon: COSMOS_ICONS.sun,
        bakedIcon: COSMOS_BAKED.sun,
        bakedClipR: 1.511241,
        emoji: "☀️",
        color: "#facc15",
        radius: RADII[10],
        scoreValue: SCORE_VALUES[10],
      },
    ],
  },
};

export const DEFAULT_FRUIT_SET = "fruits";

// Max tier that can appear in the drop queue (avoids spawning huge fruits)
export const MAX_SPAWN_TIER: FruitTier = 4;
