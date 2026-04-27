import React, { useCallback, useRef, useState } from "react";
import { LayoutChangeEvent, Modal, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
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
import { useStarSwarmAudio } from "../hooks/useStarSwarmAudio";

export default function StarSwarmScreen() {
  const { t } = useTranslation("starswarm");
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

  const {
    playLaser,
    playChargeShot,
    playExplosion,
    playPlayerHit,
    playWaveClear,
    playGameOver,
    playChallengingStage,
  } = useStarSwarmAudio(phase !== "GameOver");

  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);

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

  const handleNewGame = useCallback((opts?: DevOptions) => {
    scoreRef.current = 0;
    setPhase("SwoopIn");
    setIsPaused(false);
    canvasRef.current?.reset(opts);
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

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
              isPaused={isPaused}
              width={CANVAS_W}
              height={CANVAS_H}
              scale={scale}
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
              <Pressable style={styles.devButton} onPress={() => setDevPanelOpen(true)}>
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
              <View style={styles.devPanel}>
                <Text style={styles.devTitle}>Dev Panel</Text>

                <View style={styles.devRow}>
                  <Text style={styles.devLabel}>Wave</Text>
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
                  <Text style={styles.devLabel}>Infinite lives</Text>
                  <Switch value={devInfiniteLives} onValueChange={setDevInfiniteLives} />
                </View>

                <Pressable
                  style={[styles.devActionBtn, styles.devPrimary]}
                  onPress={() => {
                    setDevPanelOpen(false);
                    handleNewGame({ wave: devWave, infiniteLives: devInfiniteLives });
                  }}
                >
                  <Text style={styles.devPrimaryText}>New Game</Text>
                </Pressable>

                <Pressable style={styles.devActionBtn} onPress={() => setDevPanelOpen(false)}>
                  <Text style={styles.devLabel}>Close</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </GameShell>
  );
}

const styles = StyleSheet.create({
  canvasOuter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  devButton: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: "rgba(255,80,0,0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    zIndex: 100,
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
  devPanel: {
    backgroundColor: "#1a1a2e",
    borderRadius: 12,
    padding: 24,
    width: 280,
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255,80,0,0.5)",
  },
  devTitle: {
    color: "#ff5000",
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    textTransform: "uppercase",
  },
  devRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  devLabel: {
    color: "#ccc",
    fontSize: 13,
    flex: 1,
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
  devActionBtn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  devPrimary: {
    backgroundColor: "#ff5000",
  },
  devPrimaryText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
