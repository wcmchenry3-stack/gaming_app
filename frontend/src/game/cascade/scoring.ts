import { FruitTier } from "../../theme/fruitSets.engine";

const WATERMELON_BONUS = 256;

export function scoreForMerge(tier: FruitTier): number {
  // Tier 10 (Watermelon) disappears on merge — award bonus
  if (tier === 10) return WATERMELON_BONUS;
  // Otherwise award the score value of the resulting (higher) tier
  return Math.pow(2, tier + 1) as number;
}
