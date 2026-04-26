import React, { useCallback, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import type { GameCanvasHandle } from "./GameCanvas";
import type { GamePhase } from "../../game/starswarm/types";
import { CANVAS_W, CANVAS_H } from "../../game/starswarm/engine";

const DRAG_ZONE_Y_RATIO = 0.6; // bottom 40% is the drag zone
const CHARGE_BTN_SIZE = 56;
const CHARGE_BTN_HIT_SLOP = 12;

interface Props {
  canvasRef: React.RefObject<GameCanvasHandle | null>;
  scale: number;
  phase: GamePhase;
  isPaused: boolean;
  onPause: () => void;
  onResume: () => void;
  onNewGame: () => void;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function Controls({
  canvasRef,
  scale,
  phase,
  isPaused,
  onPause,
  onResume,
  onNewGame,
}: Props) {
  const { t } = useTranslation("starswarm");

  const displayW = Math.round(CANVAS_W * scale);
  const displayH = Math.round(CANVAS_H * scale);
  const dragZoneY = displayH * DRAG_ZONE_Y_RATIO;

  const playerXRef = useRef(CANVAS_W / 2);
  const activeDragRef = useRef(false);

  const [isCharging, setIsCharging] = useState(false);

  const resetPlayerX = useCallback(() => {
    playerXRef.current = CANVAS_W / 2;
  }, []);

  // Reset player X tracking on new game
  const handleNewGame = useCallback(() => {
    resetPlayerX();
    onNewGame();
  }, [resetPlayerX, onNewGame]);

  const panGesture = Gesture.Pan()
    .runOnJS(true)
    .minDistance(0)
    .onBegin((e) => {
      activeDragRef.current = e.y > dragZoneY;
    })
    .onChange((e) => {
      if (!activeDragRef.current) return;
      const logicalDx = e.changeX / scale;
      const newX = clamp(playerXRef.current + logicalDx, 0, CANVAS_W);
      playerXRef.current = newX;
      canvasRef.current?.setPlayerX(newX);
    })
    .onEnd((e) => {
      if (!activeDragRef.current && e.y < dragZoneY && Math.abs(e.translationX) < 10) {
        // Short tap in top zone → pause
        if (!isPaused && phase === "Playing") onPause();
      }
      activeDragRef.current = false;
    })
    .onFinalize(() => {
      activeDragRef.current = false;
    });

  const isGameOver = phase === "GameOver";
  const gameActive = !isGameOver && !isPaused;

  return (
    <GestureDetector gesture={panGesture}>
      <View
        style={[styles.overlay, { width: displayW, height: displayH }]}
        pointerEvents="box-none"
      >
        {/* Charge shot button — bottom-right corner, only during active play */}
        {gameActive && (
          <Pressable
            style={[
              styles.chargeBtn,
              isCharging && styles.chargeBtnActive,
              {
                bottom: Platform.OS === "web" ? 20 : 28,
                right: 12,
              },
            ]}
            hitSlop={CHARGE_BTN_HIT_SLOP}
            accessibilityLabel={t("controls.chargeShotLabel")}
            accessibilityRole="button"
            onPressIn={() => setIsCharging(true)}
            onPressOut={() => {
              setIsCharging(false);
              canvasRef.current?.setChargeShot(true);
            }}
          >
            <Text style={styles.chargeBtnIcon} aria-hidden>
              ⚡
            </Text>
          </Pressable>
        )}

        {/* Pause overlay */}
        {isPaused && !isGameOver && (
          <Pressable
            style={styles.pauseOverlay}
            onPress={onResume}
            accessibilityLabel={t("controls.resumeLabel")}
            accessibilityRole="button"
          >
            <Text style={styles.pauseTitle}>{t("controls.paused")}</Text>
            <Text style={styles.pauseHint}>{t("controls.tapToResume")}</Text>
          </Pressable>
        )}

        {/* Game-over new-game button */}
        {isGameOver && (
          <View style={styles.gameOverActions}>
            <Pressable
              style={styles.newGameBtn}
              onPress={handleNewGame}
              accessibilityLabel={t("controls.newGameLabel")}
              accessibilityRole="button"
            >
              <Text style={styles.newGameBtnText}>{t("controls.newGame")}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}

/** Call from StarSwarmScreen when the player is hit (short impact). */
export function hapticPlayerHit() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

/** Call from StarSwarmScreen on player death / game over (medium impact). */
export function hapticPlayerDeath() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
}

/** Call from StarSwarmScreen on wave clear (light notification). */
export function hapticWaveClear() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  chargeBtn: {
    position: "absolute",
    width: CHARGE_BTN_SIZE,
    height: CHARGE_BTN_SIZE,
    borderRadius: CHARGE_BTN_SIZE / 2,
    backgroundColor: "rgba(0, 200, 255, 0.18)",
    borderWidth: 2,
    borderColor: "rgba(0, 200, 255, 0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  chargeBtnActive: {
    backgroundColor: "rgba(0, 200, 255, 0.42)",
    borderColor: "#00ffcc",
  },
  chargeBtnIcon: {
    fontSize: 26,
  },
  pauseOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 16, 0.72)",
    alignItems: "center",
    justifyContent: "center",
  },
  pauseTitle: {
    color: "#00ffcc",
    fontSize: 26,
    fontWeight: "bold",
    letterSpacing: 3,
  },
  pauseHint: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    marginTop: 12,
  },
  gameOverActions: {
    position: "absolute",
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  newGameBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#00ffcc",
  },
  newGameBtnText: {
    color: "#000010",
    fontWeight: "bold",
    fontSize: 16,
    letterSpacing: 1,
  },
});
