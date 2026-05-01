export type FruitTier = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface FruitDefinition {
  tier: FruitTier;
  name: string;
  nameKey?: string;
  emoji: string;
  color: string;
  radius: number;
  scoreValue: number;
}

export interface FruitSet {
  id: string;
  label: string;
  fruits: FruitDefinition[];
}

export const MAX_SPAWN_TIER: FruitTier = 4;
