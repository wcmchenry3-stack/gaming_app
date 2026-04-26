import { useBackgroundMusic } from "../_shared/useBackgroundMusic";
import { useSound } from "../_shared/useSound";

const BG_KEYS = ["mahjong.bg1", "mahjong.bg2", "mahjong.bg3"] as const;

export function useMahjongAudio(active: boolean) {
  useBackgroundMusic([...BG_KEYS], active);

  const { play: playTileSelect } = useSound("mahjong.tileSelect");
  const { play: playTileMatch } = useSound("mahjong.tileMatch");
  const { play: playShuffle } = useSound("mahjong.shuffle");
  const { play: playWin } = useSound("mahjong.win");
  const { play: playDeadlock } = useSound("mahjong.deadlock");

  return { playTileSelect, playTileMatch, playShuffle, playWin, playDeadlock };
}
