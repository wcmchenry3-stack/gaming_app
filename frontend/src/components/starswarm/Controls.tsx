import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { useTranslation } from "react-i18next";
import type { GameCanvasHandle } from "./GameCanvas";
import type { GamePhase } from "../../game/starswarm/types";
import { CANVAS_W, CANVAS_H, CHARGE_SHOOT_COOLDOWN } from "../../game/starswarm/engine";

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
  // Ship X captured at each touch-start — used to compute delta from gesture start,
  // avoiding cumulative drift from per-event changeX accumulation.
  const shipXAtDragStartRef = useRef(CANVAS_W / 2);

  const [isCharging, setIsCharging] = useState(false);
  const [isOnCooldown, setIsOnCooldown] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isCharging) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.22, duration: 280, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.stopAnimation();
      Animated.spring(pulseAnim, { toValue: 1, useNativeDriver: true, bounciness: 0 }).start();
    }
  }, [isCharging, pulseAnim]);

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
      if (activeDragRef.current) {
        // Capture ship X at gesture start so we use total translation (not
        // per-event changeX accumulation) — avoids drift over long gestures.
        shipXAtDragStartRef.current = playerXRef.current;
      }
    })
    .onChange((e) => {
      if (!activeDragRef.current) return;
      // newX = shipX_at_touch_start + (currentTouchX - touchStartX)
      const newX = clamp(shipXAtDragStartRef.current + e.translationX / scale, 0, CANVAS_W);
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

  // Arrow-key movement for web (and external keyboards on iOS).
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const STEP = 6;
    const held = new Set<string>();
    let rafId: number;

    function loop() {
      if (held.size > 0) {
        const dx = (held.has("ArrowRight") ? STEP : 0) - (held.has("ArrowLeft") ? STEP : 0);
        if (dx !== 0) {
          playerXRef.current = clamp(playerXRef.current + dx, 0, CANVAS_W);
          canvasRef.current?.setPlayerX(playerXRef.current);
        }
      }
      rafId = requestAnimationFrame(loop);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        held.add(e.key);
      }
    }
    function onKeyUp(e: KeyboardEvent) {
      held.delete(e.key);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    rafId = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cancelAnimationFrame(rafId);
    };
  }, [canvasRef]);

  const isGameOver = phase === "GameOver";
  const gameActive = !isGameOver && !isPaused;

  return (
    <GestureDetector gesture={panGesture}>
      <View style={[styles.overlay, { width: displayW, height: displayH }]}>
        {/* Charge shot button — bottom-right corner, only during active play */}
        {gameActive && (
          <Animated.View
            style={[
              styles.chargeBtnWrap,
              {
                bottom: Platform.OS === "web" ? 20 : 28,
                right: 12,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Pressable
              style={[
                styles.chargeBtn,
                isCharging && styles.chargeBtnActive,
                isOnCooldown && !isCharging && styles.chargeBtnCooldown,
              ]}
              hitSlop={CHARGE_BTN_HIT_SLOP}
              accessibilityLabel={t("controls.chargeShotLabel")}
              accessibilityRole="button"
              onPressIn={() => setIsCharging(true)}
              onPressOut={() => {
                setIsCharging(false);
                setIsOnCooldown(true);
                canvasRef.current?.setChargeShot(true);
                if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
                cooldownTimerRef.current = setTimeout(
                  () => setIsOnCooldown(false),
                  CHARGE_SHOOT_COOLDOWN
                );
              }}
            >
              <Text style={styles.chargeBtnIcon} aria-hidden>
                ⚡
              </Text>
            </Pressable>
          </Animated.View>
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
  chargeBtnWrap: {
    position: "absolute",
    width: CHARGE_BTN_SIZE,
    height: CHARGE_BTN_SIZE,
  },
  chargeBtn: {
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
  chargeBtnCooldown: {
    opacity: 0.35,
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
