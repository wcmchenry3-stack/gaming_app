import { useEffect, useRef } from "react";
import { createAudioPlayer, AudioPlayer } from "expo-audio";
import { useSoundSettings } from "./SoundContext";
import { SOUND_REGISTRY, SoundKey } from "./sounds";

const BG_VOLUME = 0.2;

// Picks a random track from keys on each active→true transition (new game session).
// Volume is kept low (BG_VOLUME) to sit behind SFX.
export function useBackgroundMusic(keys: SoundKey[], active: boolean): void {
  const { muted } = useSoundSettings();
  const playerRef = useRef<AudioPlayer | null>(null);
  const mutedRef = useRef(muted);
  const keysRef = useRef(keys);
  const prevActiveRef = useRef<boolean | null>(null);

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  useEffect(() => {
    keysRef.current = keys;
  }, [keys]);

  // React to active changing: pause on false, start new track on false→true.
  useEffect(() => {
    const wasActive = prevActiveRef.current;
    prevActiveRef.current = active;

    if (!active) {
      playerRef.current?.pause();
      return;
    }

    if (wasActive === true) {
      // Resuming (e.g. unpause) — continue the existing track if not muted.
      if (!mutedRef.current && playerRef.current) {
        try {
          playerRef.current.play();
        } catch {
          // web AudioContext suspended — fail silently
        }
      }
      return;
    }

    // New session (null→true on mount, or false→true after game over): pick a new track.
    playerRef.current?.remove();

    const currentKeys = keysRef.current;
    const key = currentKeys[Math.floor(Math.random() * currentKeys.length)];
    const source = key != null ? SOUND_REGISTRY[key] : undefined;
    if (!source) {
      playerRef.current = null;
      return;
    }

    const player = createAudioPlayer(source);
    player.loop = true;
    player.volume = BG_VOLUME;
    playerRef.current = player;

    if (!mutedRef.current) {
      try {
        player.play();
      } catch {
        // web AudioContext suspended — fail silently
      }
    }
  }, [active]);

  // React to mute toggle independently of active.
  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    if (muted) {
      player.pause();
    } else if (prevActiveRef.current) {
      try {
        player.play();
      } catch {
        // web AudioContext suspended — fail silently
      }
    }
  }, [muted]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      playerRef.current?.remove();
      playerRef.current = null;
    };
  }, []);
}
