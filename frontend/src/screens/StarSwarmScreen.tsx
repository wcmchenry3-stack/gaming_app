import React, { useCallback, useRef, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "../../App";
import { GameShell } from "../components/shared/GameShell";
import GameCanvas from "../components/starswarm/GameCanvas";
import type { GameCanvasHandle } from "../components/starswarm/GameCanvas";
import Controls, {
  hapticPlayerHit,
  hapticPlayerDeath,
  hapticWaveClear,
} from "../components/starswarm/Controls";
import { CANVAS_W, CANVAS_H } from "../game/starswarm/engine";
import type { GamePhase } from "../game/starswarm/types";

export default function StarSwarmScreen() {
  const { t } = useTranslation("starswarm");
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<HomeStackParamList, "StarSwarm">>();

  const canvasRef = useRef<GameCanvasHandle>(null);

  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [phase, setPhase] = useState<GamePhase>("SwoopIn");
  const [isPaused, setIsPaused] = useState(false);
  const [containerW, setContainerW] = useState(0);
  const [containerH, setContainerH] = useState(0);

  const scoreRef = useRef(0);
  const highScoreRef = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerW(Math.floor(width));
    setContainerH(Math.floor(height));
  }, []);

  const handleScoreChange = useCallback((s: number) => {
    scoreRef.current = s;
    setScore(s);
  }, []);

  const handleGameOver = useCallback((finalScore: number) => {
    setPhase("GameOver");
    hapticPlayerDeath();
    if (finalScore > highScoreRef.current) {
      highScoreRef.current = finalScore;
      setHighScore(finalScore);
    }
  }, []);

  const handlePlayerHit = useCallback(() => {
    hapticPlayerHit();
  }, []);

  const handleWaveClear = useCallback(() => {
    setPhase("WaveClear");
    hapticWaveClear();
  }, []);

  // GameCanvas reports phase changes only for GameOver / WaveClear via callbacks.
  // For other phases we rely on the game loop advancing — this is cosmetic only
  // (phase is used by Controls to know when to show buttons).
  const handlePhaseResume = useCallback(() => {
    setPhase("Playing");
  }, []);

  const handleNewGame = useCallback(() => {
    scoreRef.current = 0;
    setScore(0);
    setPhase("SwoopIn");
    setIsPaused(false);
    canvasRef.current?.reset();
  }, []);

  const handlePause = useCallback(() => {
    setIsPaused(true);
  }, []);

  const handleResume = useCallback(() => {
    setIsPaused(false);
  }, []);

  const scale =
    containerW > 0 && containerH > 0
      ? Math.min(containerW / CANVAS_W, containerH / CANVAS_H)
      : 0;

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
          </View>
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
});
