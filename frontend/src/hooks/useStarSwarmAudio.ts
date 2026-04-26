import { useSound } from "../game/_shared/useSound";
import { useBackgroundMusic } from "../game/_shared/useBackgroundMusic";

const BG_KEYS = ["starswarm.bg1", "starswarm.bg2", "starswarm.bg3", "starswarm.bg4"] as const;

// bgMusicActive should be false when the game is over so the track stops.
export function useStarSwarmAudio(bgMusicActive: boolean) {
  useBackgroundMusic(BG_KEYS as unknown as string[], bgMusicActive);

  const { play: playLaser } = useSound("starswarm.laser", 0.35);
  const { play: playChargeShot } = useSound("starswarm.chargeshot", 0.6);
  const { play: playExplosion } = useSound("starswarm.explosion", 0.45);
  const { play: playPlayerHit } = useSound("starswarm.playerhit", 0.7);
  const { play: playWaveClear } = useSound("starswarm.waveclear", 0.8);
  const { play: playGameOver } = useSound("starswarm.gameover", 0.8);
  const { play: playChallengingStage } = useSound("starswarm.challengingstage", 0.8);

  return {
    playLaser,
    playChargeShot,
    playExplosion,
    playPlayerHit,
    playWaveClear,
    playGameOver,
    playChallengingStage,
  };
}
