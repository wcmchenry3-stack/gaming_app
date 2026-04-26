import { useSound } from "../game/_shared/useSound";
import { useBackgroundMusic } from "../game/_shared/useBackgroundMusic";

const BG_KEYS = ["starswarm.bg1", "starswarm.bg2", "starswarm.bg3", "starswarm.bg4"] as const;

// bgMusicActive should be false when the game is over so the track stops.
export function useStarSwarmAudio(bgMusicActive: boolean) {
  useBackgroundMusic(BG_KEYS as unknown as string[], bgMusicActive);

  const { play: playLaser } = useSound("starswarm.laser");
  const { play: playChargeShot } = useSound("starswarm.chargeshot");
  const { play: playExplosion } = useSound("starswarm.explosion");
  const { play: playPlayerHit } = useSound("starswarm.playerhit");
  const { play: playWaveClear } = useSound("starswarm.waveclear");
  const { play: playGameOver } = useSound("starswarm.gameover");
  const { play: playChallengingStage } = useSound("starswarm.challengingstage");

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
