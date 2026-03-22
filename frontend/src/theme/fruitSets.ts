export type FruitTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface FruitDefinition {
  tier: FruitTier;
  name: string;
  emoji: string;
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

export const FRUIT_SETS: Record<string, FruitSet> = {
  fruits: {
    id: "fruits",
    label: "Fruits",
    fruits: [
      {
        tier: 0,
        name: "Cherry",
        emoji: "🍒",
        color: "#dc2626",
        radius: RADII[0],
        scoreValue: SCORE_VALUES[0],
      },
      {
        tier: 1,
        name: "Blueberry",
        emoji: "🫐",
        color: "#6d28d9",
        radius: RADII[1],
        scoreValue: SCORE_VALUES[1],
      },
      {
        tier: 2,
        name: "Lemon",
        emoji: "🍋",
        color: "#ca8a04",
        radius: RADII[2],
        scoreValue: SCORE_VALUES[2],
      },
      {
        tier: 3,
        name: "Grape",
        emoji: "🍇",
        color: "#7c3aed",
        radius: RADII[3],
        scoreValue: SCORE_VALUES[3],
      },
      {
        tier: 4,
        name: "Orange",
        emoji: "🍊",
        color: "#ea580c",
        radius: RADII[4],
        scoreValue: SCORE_VALUES[4],
      },
      {
        tier: 5,
        name: "Apple",
        emoji: "🍎",
        color: "#dc2626",
        radius: RADII[5],
        scoreValue: SCORE_VALUES[5],
      },
      {
        tier: 6,
        name: "Peach",
        emoji: "🍑",
        color: "#f97316",
        radius: RADII[6],
        scoreValue: SCORE_VALUES[6],
      },
      {
        tier: 7,
        name: "Coconut",
        emoji: "🥥",
        color: "#78716c",
        radius: RADII[7],
        scoreValue: SCORE_VALUES[7],
      },
      {
        tier: 8,
        name: "Dragonfruit",
        emoji: "🐉",
        color: "#db2777",
        radius: RADII[8],
        scoreValue: SCORE_VALUES[8],
      },
      {
        tier: 9,
        name: "Pineapple",
        emoji: "🍍",
        color: "#ca8a04",
        radius: RADII[9],
        scoreValue: SCORE_VALUES[9],
      },
      {
        tier: 10,
        name: "Watermelon",
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
        emoji: "🌙",
        color: "#d1d5db",
        radius: RADII[0],
        scoreValue: SCORE_VALUES[0],
      },
      {
        tier: 1,
        name: "Mercury",
        emoji: "🪨",
        color: "#9ca3af",
        radius: RADII[1],
        scoreValue: SCORE_VALUES[1],
      },
      {
        tier: 2,
        name: "Mars",
        emoji: "🔴",
        color: "#dc2626",
        radius: RADII[2],
        scoreValue: SCORE_VALUES[2],
      },
      {
        tier: 3,
        name: "Venus",
        emoji: "🟡",
        color: "#fbbf24",
        radius: RADII[3],
        scoreValue: SCORE_VALUES[3],
      },
      {
        tier: 4,
        name: "Earth",
        emoji: "🌍",
        color: "#2563eb",
        radius: RADII[4],
        scoreValue: SCORE_VALUES[4],
      },
      {
        tier: 5,
        name: "Neptune",
        emoji: "🔵",
        color: "#1d4ed8",
        radius: RADII[5],
        scoreValue: SCORE_VALUES[5],
      },
      {
        tier: 6,
        name: "Uranus",
        emoji: "🩵",
        color: "#67e8f9",
        radius: RADII[6],
        scoreValue: SCORE_VALUES[6],
      },
      {
        tier: 7,
        name: "Saturn",
        emoji: "🪐",
        color: "#ca8a04",
        radius: RADII[7],
        scoreValue: SCORE_VALUES[7],
      },
      {
        tier: 8,
        name: "Jupiter",
        emoji: "🟠",
        color: "#ea580c",
        radius: RADII[8],
        scoreValue: SCORE_VALUES[8],
      },
      {
        tier: 9,
        name: "Sun",
        emoji: "☀️",
        color: "#facc15",
        radius: RADII[9],
        scoreValue: SCORE_VALUES[9],
      },
      {
        tier: 10,
        name: "Galaxy",
        emoji: "🌌",
        color: "#312e81",
        radius: RADII[10],
        scoreValue: SCORE_VALUES[10],
      },
    ],
  },
};

export const DEFAULT_FRUIT_SET = "fruits";

// Max tier that can appear in the drop queue (avoids spawning huge fruits)
export const MAX_SPAWN_TIER: FruitTier = 4;
