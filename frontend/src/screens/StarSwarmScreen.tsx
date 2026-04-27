import React, { useCallback, useRef, useState } from "react";
import {
  LayoutChangeEvent,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "../theme/ThemeContext";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "../../App";
import { GameShell } from "../components/shared/GameShell";
import GameCanvas from "../components/starswarm/GameCanvas";
import type { GameCanvasHandle, DevOptions } from "../components/starswarm/GameCanvas";
import Controls, {
  hapticPlayerHit,
  hapticPlayerDeath,
  hapticWaveClear,
} from "../components/starswarm/Controls";
import { CANVAS_W, CANVAS_H } from "../game/starswarm/engine";
import type { GamePhase } from "../game/starswarm/types";
import { useStarSwarmAudio, DEFAULT_SFX_VOLUMES } from "../hooks/useStarSwarmAudio";
import type { SfxVolumes } from "../hooks/useStarSwarmAudio";

export default function StarSwarmScreen() {
  const { t } = useTranslation("starswarm");
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, "StarSwarm">>();

  const canvasRef = useRef<GameCanvasHandle>(null);

  const [highScore, setHighScore] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("SwoopIn");
  const [isPaused, setIsPaused] = useState(false);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);

  // Dev panel state — stripped from production builds by Metro's __DEV__ dead-code elimination
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [devWave, setDevWave] = useState(1);
  const [devInfiniteLives, setDevInfiniteLives] = useState(false);
  const [devVolumes, setDevVolumes] = useState<SfxVolumes>(DEFAULT_SFX_VOLUMES);

  const adjustVolume = useCallback((key: keyof SfxVolumes, delta: number) => {
    setDevVolumes((v) => ({
      ...v,
      [key]: Math.round(Math.min(1, Math.max(0, v[key] + delta)) * 10) / 10,
    }));
  }, []);

  const {
    playLaser,
    playChargeShot,
    playExplosion,
    playPlayerHit,
    playWaveClear,
    playGameOver,
    playChallengingStage,
    playBonusLife,
  } = useStarSwarmAudio(phase !== "GameOver", devVolumes);

  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);
  // Increments on every new-game request; GameCanvas watches this via useEffect to reset.
  const [resetTick, setResetTick] = useState(0);
  // In dev builds, track the last opts from the panel so every subsequent "New Game"
  // (header, game-over overlay) re-applies them without reopening the dev panel.
  const lastDevOptsRef = useRef<DevOptions | undefined>(undefined);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerW(Math.floor(width));
    setContainerH(Math.floor(height));
  }, []);

  const handleScoreChange = useCallback((s: number) => {
    scoreRef.current = s;
  }, []);

  const handleGameOver = useCallback(
    (finalScore: number) => {
      setPhase("GameOver");
      playGameOver();
      hapticPlayerDeath();
      if (finalScore > highScoreRef.current) {
        highScoreRef.current = finalScore;
        setHighScore(finalScore);
      }
    },
    [playGameOver]
  );

  const handlePlayerHit = useCallback(() => {
    playPlayerHit();
    hapticPlayerHit();
  }, [playPlayerHit]);

  const handleWaveClear = useCallback(() => {
    setPhase("WaveClear");
    playWaveClear();
    hapticWaveClear();
  }, [playWaveClear]);

  const handleBonusLife = useCallback(() => {
    playBonusLife();
  }, [playBonusLife]);

  const handleNewGame = useCallback((opts?: DevOptions) => {
    if (__DEV__ && opts !== undefined) lastDevOptsRef.current = opts;
    scoreRef.current = 0;
    setPhase("SwoopIn");
    setIsPaused(false);
    setResetTick((t) => t + 1);
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const dynamicStyles = getStyles(colors);

  const scale =
    containerW > 0 && containerH > 0 ? Math.min(containerW / CANVAS_W, containerH / CANVAS_H) : 0;

  const displayW = Math.round(CANVAS_W * scale);
  const displayH = Math.round(CANVAS_H * scale);

  return (
    <GameShell
      title={t("game.title")}
      requireBack
      onBack={() => navigation.popToTop()}
      onNewGame={handleNewGame}
      style={{
        paddingBottom: Math.max(insets.bottom, 8),
        paddingLeft: Math.max(insets.left, 0),
        paddingRight: Math.max(insets.right, 0),
      }}
    >
      <View style={styles.canvasOuter} onLayout={onLayout}>
        {scale > 0 && (
          <View style={{ width: displayW, height: displayH }}>
            <GameCanvas
              ref={canvasRef}
              highScore={highScore}
              onScoreChange={handleScoreChange}
              onGameOver={handleGameOver}
              onPlayerHit={handlePlayerHit}
              onWaveClear={handleWaveClear}
              onLaserFire={playLaser}
              onChargeShotFire={playChargeShot}
              onExplosion={playExplosion}
              onChallengingStage={playChallengingStage}
              onBonusLife={handleBonusLife}
              isPaused={isPaused}
              width={CANVAS_W}
              height={CANVAS_H}
              scale={scale}
              resetTick={resetTick}
              devOptions={lastDevOptsRef.current}
            />
            <Controls
              canvasRef={canvasRef}
              scale={scale}
              phase={phase}
              isPaused={isPaused}
              onPause={handlePause}
              onResume={handleResume}
              onNewGame={handleNewGame}
            />
            {__DEV__ && (
              <Pressable style={dynamicStyles.devButton} onPress={() => setDevPanelOpen(true)}>
                <Text style={styles.devButtonText}>DEV</Text>
              </Pressable>
            )}
          </View>
        )}
        {__DEV__ && (
          <Modal
            visible={devPanelOpen}
            transparent
            animationType="fade"
            accessibilityViewIsModal
            onRequestClose={() => setDevPanelOpen(false)}
          >
            <View style={styles.devOverlay}>
              <View style={dynamicStyles.devPanel}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.devScrollContent}
                >
                  <Text style={dynamicStyles.devTitle}>Dev Panel</Text>

                  <View style={styles.devRow}>
                    <Text style={dynamicStyles.devLabel}>Wave</Text>
                    <Pressable
                      style={styles.devStepBtn}
                      onPress={() => setDevWave((w) => Math.max(1, w - 1))}
                      accessibilityLabel="Decrease wave"
                    >
                      <Text style={styles.devStepText}>−</Text>
                    </Pressable>
                    <Text style={styles.devValue}>{devWave}</Text>
                    <Pressable
                      style={styles.devStepBtn}
                      onPress={() => setDevWave((w) => Math.min(15, w + 1))}
                      accessibilityLabel="Increase wave"
                    >
                      <Text style={styles.devStepText}>+</Text>
                    </Pressable>
                  </View>

                  <View style={styles.devRow}>
                    <Text style={dynamicStyles.devLabel}>Infinite lives</Text>
                    <Switch value={devInfiniteLives} onValueChange={setDevInfiniteLives} />
                  </View>

                  <Text style={dynamicStyles.devSectionHeader}>── Sound Mixer ──</Text>

                  {(
                    [
                      ["Laser", "laser"],
                      ["Charge shot", "chargeshot"],
                      ["Explosion", "explosion"],
                      ["Player hit", "playerhit"],
                      ["Wave clear", "waveclear"],
                      ["Game over", "gameover"],
                      ["Challenging", "challengingstage"],
                    ] as [string, keyof SfxVolumes][]
                  ).map(([label, key]) => (
                    <View key={key} style={styles.devRow}>
                      <Text style={[dynamicStyles.devLabel, styles.devMixerLabel]}>{label}</Text>
                      <Pressable
                        style={styles.devStepBtn}
                        onPress={() => adjustVolume(key, -0.1)}
                        accessibilityLabel={`Decrease ${label} volume`}
                      >
                        <Text style={styles.devStepText}>−</Text>
                      </Pressable>
                      <Text style={styles.devValue}>{devVolumes[key].toFixed(1)}</Text>
                      <Pressable
                        style={styles.devStepBtn}
                        onPress={() => adjustVolume(key, 0.1)}
                        accessibilityLabel={`Increase ${label} volume`}
                      >
                        <Text style={styles.devStepText}>+</Text>
                      </Pressable>
                    </View>
                  ))}

                  <Pressable
                    style={[styles.devActionBtn, dynamicStyles.devPrimary]}
                    onPress={() => {
                      setDevPanelOpen(false);
                      handleNewGame({ wave: devWave, infiniteLives: devInfiniteLives });
                    }}
                  >
                    <Text style={styles.devPrimaryText}>New Game</Text>
                  </Pressable>

                  <Pressable style={styles.devActionBtn} onPress={() => setDevPanelOpen(false)}>
                    <Text style={dynamicStyles.devLabel}>Close</Text>
                  </Pressable>
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </GameShell>
  );
}

const baseStyles = StyleSheet.create({
  canvasOuter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  devButtonText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
  },
  devOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  devRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  devStepBtn: {
    backgroundColor: "rgba(255,255,255,0.1)",
    width: 32,
    height: 32,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  devStepText: {
    color: "#fff",
    fontSize: 18,
    lineHeight: 22,
  },
  devValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    minWidth: 28,
    textAlign: "center",
  },
  devScrollContent: {
    gap: 16,
  },
  devMixerLabel: {
    fontSize: 11,
    minWidth: 80,
  },
  devActionBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  devPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});

// Create dynamic styles based on theme tokens to comply with design-tokens policy
const getStyles = (colors: ReturnType<typeof useTheme>["colors"]) =>
  StyleSheet.create({
    ...baseStyles,
    devButton: {
      position: "absolute",
      top: 6,
      left: 6,
      backgroundColor: "rgba(255,128,0,0.85)",
      paddingHorizontal: 6,
      paddingVertical: 2,
      borderRadius: 4,
      zIndex: 100,
    },
    devPanel: {
      backgroundColor: colors.surfaceHigh,
      borderRadius: 12,
      padding: 24,
      width: 300,
      maxHeight: "80%",
      borderWidth: 1,
      borderColor: "rgba(255,128,0,0.5)",
    },
    devTitle: {
      color: "rgba(255,128,0,1)",
      fontSize: 14,
      fontWeight: "700",
      letterSpacing: 2,
      textAlign: "center",
      textTransform: "uppercase",
    },
    devLabel: {
      color: colors.textMuted,
      fontSize: 13,
      flex: 1,
    },
    devSectionHeader: {
      color: "rgba(255,128,0,0.7)",
      fontSize: 10,
      letterSpacing: 1,
      textAlign: "center",
      marginTop: 4,
    },
    devPrimary: {
      backgroundColor: "rgba(255,128,0,1)",
    },
  });

const styles = baseStyles;
