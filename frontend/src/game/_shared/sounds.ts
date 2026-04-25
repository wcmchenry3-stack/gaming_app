// Sound asset registry.
//
// SoundKey is a string union — add new keys here when wiring a game's sounds.
// The corresponding require() goes in SOUND_REGISTRY.
// Hearts keys (moonShot, heartsBroken, queenOfSpades) are added in #773–#775.
export type SoundKey = string;

// Metro resolves require() at bundle time so assets must be static literals.
// Each game-specific issue adds its entries here.
export const SOUND_REGISTRY: Partial<Record<SoundKey, number>> = {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  "hearts.heartsBroken": require("../../assets/sounds/hearts-broken.mp3"),
};
