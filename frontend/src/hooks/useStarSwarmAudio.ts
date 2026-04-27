import { useSound } from "../game/_shared/useSound";
import { useBackgroundMusic } from "../game/_shared/useBackgroundMusic";

const BG_KEYS = ["starswarm.bg1", "starswarm.bg2", "starswarm.bg3", "starswarm.bg4"] as const;

export interface SfxVolumes {
  laser: number;
  chargeshot: number;
  explosion: number;
  playerhit: number;
  waveclear: number;
  gameover: number;
  challengingstage: number;
  bonuslife: number;
}

export const DEFAULT_SFX_VOLUMES: SfxVolumes = {
  laser: 0,
  chargeshot: 0.6,
  explosion: 0.45,
  playerhit: 0.7,
  waveclear: 0.8,
  gameover: 0.8,
  challengingstage: 0.8,
  bonuslife: 0.9,
};

// bgMusicActive should be false when the game is over so the track stops.
export function useStarSwarmAudio(bgMusicActive: boolean, volumes?: Partial<SfxVolumes>) {
  useBackgroundMusic(BG_KEYS as unknown as string[], bgMusicActive);

  const v = { ...DEFAULT_SFX_VOLUMES, ...volumes };

  const { play: playLaser } = useSound("starswarm.laser", v.laser);
  const { play: playChargeShot } = useSound("starswarm.chargeshot", v.chargeshot);
  const { play: playExplosion } = useSound("starswarm.explosion", v.explosion);
  const { play: playPlayerHit } = useSound("starswarm.playerhit", v.playerhit);
  const { play: playWaveClear } = useSound("starswarm.waveclear", v.waveclear);
  const { play: playGameOver } = useSound("starswarm.gameover", v.gameover);
  const { play: playChallengingStage } = useSound("starswarm.challengingstage", v.challengingstage);
  const { play: playBonusLife } = useSound("starswarm.bonuslife", v.bonuslife);

  return {
    playLaser,
    playChargeShot,
    playExplosion,
    playPlayerHit,
    playWaveClear,
    playGameOver,
    playChallengingStage,
    playBonusLife,
  };
}
