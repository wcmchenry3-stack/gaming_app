import { ImageSourcePropType } from "react-native";

import { COSMOS_BAKED, COSMOS_ICONS, FRUIT_BAKED, FRUIT_ICONS } from "../game/_shared/images";

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
  5: 49,
  6: 54,
  7: 62,
  8: 75,
  9: 82,
  10: 89,
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
        bakedClipR: 1.488527,
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
        bakedClipR: 2.352905,
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
        bakedClipR: 2.369874,
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
        bakedClipR: 2.403706,
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
        bakedClipR: 2.418005,
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
        bakedClipR: 2.454604,
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
        bakedClipR: 2.508092,
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
