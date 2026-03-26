import { ImageSourcePropType } from "react-native";

export type FruitTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface FruitDefinition {
  tier: FruitTier;
  name: string;
  emoji: string;
  icon?: ImageSourcePropType;
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
  cherry: require("../../assets/fruit-icons/cherry.png"),
  blueberry: require("../../assets/fruit-icons/blueberry.png"),
  lemon: require("../../assets/fruit-icons/lemon.png"),
  grape: require("../../assets/fruit-icons/grapes.png"),
  orange: require("../../assets/fruit-icons/orange.png"),
  apple: require("../../assets/fruit-icons/apple.png"),
  peach: require("../../assets/fruit-icons/peach.png"),
  coconut: require("../../assets/fruit-icons/coconut.png"),
  dragonfruit: require("../../assets/fruit-icons/dragonfruit.png"),
  pineapple: require("../../assets/fruit-icons/pineapple.png"),
  watermelon: require("../../assets/fruit-icons/watermelon.png"),
  pumpkin: require("../../assets/fruit-icons/pumpkin.png"),
} as const;

const PLANET_ICONS = {
  moon: require("../../assets/celestial-icons/moon.png"),
  pluto: require("../../assets/celestial-icons/pluto.png"),
  mercury: require("../../assets/celestial-icons/mercury.png"),
  mars: require("../../assets/celestial-icons/mars.png"),
  venus: require("../../assets/celestial-icons/venus.png"),
  earth: require("../../assets/celestial-icons/earth.png"),
  neptune: require("../../assets/celestial-icons/neptune.png"),
  uranus: require("../../assets/celestial-icons/uranus.png"),
  saturn: require("../../assets/celestial-icons/saturn.png"),
  jupiter: require("../../assets/celestial-icons/jupiter.png"),
  sun: require("../../assets/celestial-icons/sun.png"),
  milkyWay: require("../../assets/celestial-icons/milkyway.png"),
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
        emoji: "🍒",
        color: "#dc2626",
        radius: RADII[0],
        scoreValue: SCORE_VALUES[0],
      },
      {
        tier: 1,
        name: "Blueberry",
        icon: FRUIT_ICONS.blueberry,
        emoji: "🫐",
        color: "#6d28d9",
        radius: RADII[1],
        scoreValue: SCORE_VALUES[1],
      },
      {
        tier: 2,
        name: "Lemon",
        icon: FRUIT_ICONS.lemon,
        emoji: "🍋",
        color: "#ca8a04",
        radius: RADII[2],
        scoreValue: SCORE_VALUES[2],
      },
      {
        tier: 3,
        name: "Grape",
        icon: FRUIT_ICONS.grape,
        emoji: "🍇",
        color: "#7c3aed",
        radius: RADII[3],
        scoreValue: SCORE_VALUES[3],
      },
      {
        tier: 4,
        name: "Orange",
        icon: FRUIT_ICONS.orange,
        emoji: "🍊",
        color: "#ea580c",
        radius: RADII[4],
        scoreValue: SCORE_VALUES[4],
      },
      {
        tier: 5,
        name: "Apple",
        icon: FRUIT_ICONS.apple,
        emoji: "🍎",
        color: "#dc2626",
        radius: RADII[5],
        scoreValue: SCORE_VALUES[5],
      },
      {
        tier: 6,
        name: "Peach",
        icon: FRUIT_ICONS.peach,
        emoji: "🍑",
        color: "#f97316",
        radius: RADII[6],
        scoreValue: SCORE_VALUES[6],
      },
      {
        tier: 7,
        name: "Coconut",
        icon: FRUIT_ICONS.coconut,
        emoji: "🥥",
        color: "#78716c",
        radius: RADII[7],
        scoreValue: SCORE_VALUES[7],
      },
      {
        tier: 8,
        name: "Dragonfruit",
        icon: FRUIT_ICONS.dragonfruit,
        emoji: "🐉",
        color: "#db2777",
        radius: RADII[8],
        scoreValue: SCORE_VALUES[8],
      },
      {
        tier: 9,
        name: "Pineapple",
        icon: FRUIT_ICONS.pineapple,
        emoji: "🍍",
        color: "#ca8a04",
        radius: RADII[9],
        scoreValue: SCORE_VALUES[9],
      },
      {
        tier: 10,
        name: "Watermelon",
        icon: FRUIT_ICONS.watermelon,
        emoji: "🍉",
        color: "#16a34a",
        radius: RADII[10],
        scoreValue: SCORE_VALUES[10],
      },
    ],
  },
  gems: {
    id: "gems",
    label: "Gems",
    fruits: [
      {
        tier: 0,
        name: "Chip",
        emoji: "🪨",
        color: "#9ca3af",
        radius: RADII[0],
        scoreValue: SCORE_VALUES[0],
      },
      {
        tier: 1,
        name: "Quartz",
        emoji: "🔮",
        color: "#c4b5fd",
        radius: RADII[1],
        scoreValue: SCORE_VALUES[1],
      },
      {
        tier: 2,
        name: "Topaz",
        emoji: "💛",
        color: "#fbbf24",
        radius: RADII[2],
        scoreValue: SCORE_VALUES[2],
      },
      {
        tier: 3,
        name: "Amethyst",
        emoji: "💜",
        color: "#7c3aed",
        radius: RADII[3],
        scoreValue: SCORE_VALUES[3],
      },
      {
        tier: 4,
        name: "Sapphire",
        emoji: "💙",
        color: "#2563eb",
        radius: RADII[4],
        scoreValue: SCORE_VALUES[4],
      },
      {
        tier: 5,
        name: "Emerald",
        emoji: "💚",
        color: "#16a34a",
        radius: RADII[5],
        scoreValue: SCORE_VALUES[5],
      },
      {
        tier: 6,
        name: "Ruby",
        emoji: "❤️",
        color: "#dc2626",
        radius: RADII[6],
        scoreValue: SCORE_VALUES[6],
      },
      {
        tier: 7,
        name: "Opal",
        emoji: "🌈",
        color: "#06b6d4",
        radius: RADII[7],
        scoreValue: SCORE_VALUES[7],
      },
      {
        tier: 8,
        name: "Tanzanite",
        emoji: "🫧",
        color: "#4338ca",
        radius: RADII[8],
        scoreValue: SCORE_VALUES[8],
      },
      {
        tier: 9,
        name: "Diamond",
        emoji: "💎",
        color: "#e0f2fe",
        radius: RADII[9],
        scoreValue: SCORE_VALUES[9],
      },
      {
        tier: 10,
        name: "Star gem",
        emoji: "⭐",
        color: "#fde68a",
        radius: RADII[10],
        scoreValue: SCORE_VALUES[10],
      },
    ],
  },
  planets: {
    id: "planets",
    label: "Planets",
    fruits: [
        {
          tier: 0,
          name: "Moon",
          icon: PLANET_ICONS.moon,
          emoji: "🌙",
          color: "#d1d5db",
          radius: RADII[0],
          scoreValue: SCORE_VALUES[0],
        },
        {
          tier: 1,
          name: "Pluto",
          icon: PLANET_ICONS.pluto,
          emoji: "🪨",
          color: "#94a3b8",
          radius: RADII[1],
          scoreValue: SCORE_VALUES[1],
        },
        {
          tier: 2,
          name: "Mercury",
          icon: PLANET_ICONS.mercury,
          emoji: "🪨",
          color: "#9ca3af",
          radius: RADII[2],
          scoreValue: SCORE_VALUES[2],
        },
        {
          tier: 3,
          name: "Mars",
          icon: PLANET_ICONS.mars,
          emoji: "🔴",
          color: "#dc2626",
          radius: RADII[3],
          scoreValue: SCORE_VALUES[3],
        },
        {
          tier: 4,
          name: "Venus",
          icon: PLANET_ICONS.venus,
          emoji: "🟡",
          color: "#fbbf24",
          radius: RADII[4],
          scoreValue: SCORE_VALUES[4],
        },
        {
          tier: 5,
          name: "Earth",
          icon: PLANET_ICONS.earth,
          emoji: "🌍",
          color: "#2563eb",
          radius: RADII[5],
          scoreValue: SCORE_VALUES[5],
        },
        {
          tier: 6,
          name: "Neptune",
          icon: PLANET_ICONS.neptune,
          emoji: "🔵",
          color: "#1d4ed8",
          radius: RADII[6],
          scoreValue: SCORE_VALUES[6],
        },
        {
          tier: 7,
          name: "Uranus",
          icon: PLANET_ICONS.uranus,
          emoji: "🩵",
          color: "#67e8f9",
          radius: RADII[7],
          scoreValue: SCORE_VALUES[7],
        },
        {
          tier: 8,
          name: "Saturn",
          icon: PLANET_ICONS.saturn,
          emoji: "🪐",
          color: "#ca8a04",
          radius: RADII[8],
          scoreValue: SCORE_VALUES[8],
        },
        {
          tier: 9,
          name: "Jupiter",
          icon: PLANET_ICONS.jupiter,
          emoji: "🟠",
          color: "#ea580c",
          radius: RADII[9],
          scoreValue: SCORE_VALUES[9],
        },
        {
          tier: 10,
          name: "Sun",
          icon: PLANET_ICONS.sun,
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
