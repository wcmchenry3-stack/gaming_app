import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, LayoutChangeEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { AppHeader, APP_HEADER_HEIGHT } from "../components/shared/AppHeader";
import { FruitSetProvider, useFruitSet } from "../theme/FruitSetContext";
import { FruitQueue } from "../game/cascade/fruitQueue";
import { ControlledSpawnSelector, createSeededRng } from "../game/cascade/spawnSelector";
import { MergeEvent, WORLD_W, WORLD_H } from "../game/cascade/engine";
import { scoreForMerge } from "../game/cascade/scoring";
import GameCanvas, { GameCanvasHandle } from "../components/cascade/GameCanvas";
import NextFruitPreview from "../components/cascade/NextFruitPreview";
import ScoreDisplay from "../components/cascade/ScoreDisplay";
import ThemeSelector from "../components/cascade/ThemeSelector";
import GameOverOverlay from "../components/cascade/GameOverOverlay";

function CascadeGame() {
  const { t } = useTranslation(["cascade", "common"]);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { activeFruitSet } = useFruitSet();
  const navigation =
    useNavigation<NativeStackNavigationProp<HomeStackParamList, "Cascade">>();

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [, setQueueVersion] = useState(0);

  const canvasRef = useRef<GameCanvasHandle>(null);
  const queueRef = useRef(new FruitQueue());
  const droppingRef = useRef(false);
  const lastDropTimeRef = useRef<number>(0);
  const dropCountRef = useRef<number>(0);
  const prevFruitSetId = useRef(activeFruitSet.id);

  // Refs used by test hooks to read latest state without closure staleness
  const scoreRef = useRef(0);
  const gameOverRef = useRef(false);
  const activeFruitSetRef = useRef(activeFruitSet);

  // Refs are updated synchronously at mutation sites (handleMerge,
  // handleGameOver, handleRestart, and test hooks) so that Playwright reads
  // see the latest value without waiting for a React commit to flush.
  // Only activeFruitSetRef tracks a prop and is safe to sync via effect.
  useEffect(() => {
    activeFruitSetRef.current = activeFruitSet;
  }, [activeFruitSet]);

  // Reset the engine when the player switches fruit set skin
  useEffect(() => {
    if (prevFruitSetId.current !== activeFruitSet.id) {
      prevFruitSetId.current = activeFruitSet.id;
      queueRef.current = new FruitQueue();
      scoreRef.current = 0;
      gameOverRef.current = false;
      setScore(0);
      setGameOver(false);
      setQueueVersion((v) => v + 1);
      canvasRef.current?.reset();
    }
  }, [activeFruitSet.id]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerWidth(Math.floor(width));
    setContainerHeight(Math.floor(height));
  }, []);

  const handleMerge = useCallback(
    (event: MergeEvent) => {
      const delta = scoreForMerge(event.tier);
      scoreRef.current += delta;
      setScore((s) => s + delta);
      const merged = activeFruitSet.fruits[event.tier];
      if (merged) {
        canvasRef.current?.announceEvent(t("cascade:event.merged", { fruit: merged.name }));
      }
    },
    [activeFruitSet, t]
  );

  const handleGameOver = useCallback(() => {
    canvasRef.current?.announceEvent(t("cascade:event.gameOver"));
    gameOverRef.current = true;
    setGameOver(true);
  }, [t]);

  const handleTap = useCallback(
    (x: number) => {
      const now = Date.now();
      const interval = now - lastDropTimeRef.current;

      if (gameOver || droppingRef.current) {
        console.log(
          `[Cascade] drop BLOCKED — gameOver=${gameOver} cooling=${droppingRef.current} intervalMs=${interval}`
        );
        return;
      }
      droppingRef.current = true;
      lastDropTimeRef.current = now;
      dropCountRef.current += 1;

      const tier = queueRef.current.consume();
      setQueueVersion((v) => v + 1);

      console.log(
        `[Cascade] drop #${dropCountRef.current} tier=${tier} x=${Math.round(x)} intervalMs=${interval}`
      );

      const def = activeFruitSet.fruits[tier];
      canvasRef.current?.drop(def, x);

      setTimeout(() => {
        droppingRef.current = false;
      }, 200);
    },
    [gameOver, activeFruitSet]
  );

  // -------------------------------------------------------------------------
  // Test seam — window.__cascade_* hooks (only when EXPO_PUBLIC_TEST_HOOKS=1)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (process.env.EXPO_PUBLIC_TEST_HOOKS !== "1") return;
    const g = globalThis as Record<string, unknown>;
    g.__cascade_getState = () => ({
      score: scoreRef.current,
      gameOver: gameOverRef.current,
      nextFruitTier: queueRef.current.peek(),
      ...canvasRef.current?.getEngineState?.(),
    });
    g.__cascade_setSeed = (seed: number) => {
      queueRef.current = new FruitQueue(new ControlledSpawnSelector(createSeededRng(seed)));
      setQueueVersion((v) => v + 1);
    };
    g.__cascade_dropAt = (x: number) => {
      if (gameOverRef.current) return;
      const tier = queueRef.current.consume();
      setQueueVersion((v) => v + 1);
      const def = activeFruitSetRef.current.fruits[tier];
      canvasRef.current?.drop(def, x);
    };
    g.__cascade_fastForward = (ms: number) => {
      canvasRef.current?.fastForward?.(ms);
    };
    g.__cascade_triggerGameOver = () => {
      gameOverRef.current = true;
      setGameOver(true);
    };
    g.__cascade_isReady = () => canvasRef.current?.isReady?.() === true;
    g.__cascade_spawnTierAt = (tier: number, x: number) => {
      if (gameOverRef.current) return;
      const def = activeFruitSetRef.current.fruits[tier];
      if (!def) return;
      canvasRef.current?.drop(def, x);
    };
    return () => {
      delete g.__cascade_getState;
      delete g.__cascade_setSeed;
      delete g.__cascade_dropAt;
      delete g.__cascade_fastForward;
      delete g.__cascade_triggerGameOver;
      delete g.__cascade_spawnTierAt;
      delete g.__cascade_isReady;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRestart() {
    queueRef.current = new FruitQueue();
    scoreRef.current = 0;
    gameOverRef.current = false;
    setScore(0);
    setGameOver(false);
    setQueueVersion((v) => v + 1);
    canvasRef.current?.reset();
  }

  const queue = queueRef.current;
  const currentDef = activeFruitSet.fruits[queue.peek()];
  const nextDef = activeFruitSet.fruits[queue.peekNext()];

  // Uniform scale so the fixed physics world fits the available container.
  // Uses the smaller of the two axes so the canvas always letterboxes cleanly.
  const scale =
    containerWidth > 0 && containerHeight > 0
      ? Math.min(containerWidth / WORLD_W, containerHeight / WORLD_H)
      : 0;

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: colors.background,
          paddingTop: APP_HEADER_HEIGHT + insets.top,
          paddingBottom: Math.max(insets.bottom, 16),
          paddingLeft: Math.max(insets.left, 16),
          paddingRight: Math.max(insets.right, 16),
        },
      ]}
    >
      <AppHeader title={t("game.title")} onBack={() => navigation.popToTop()} />

      {/* Score bar */}
      <ScoreDisplay score={score} />

      {/* HUD */}
      <View style={styles.hud}>
        <NextFruitPreview current={currentDef} next={nextDef} />
      </View>

      <ThemeSelector />

      {/* Canvas — portrait-constrained, centered */}
      <View style={styles.canvasOuter} onLayout={onLayout}>
        {scale > 0 && (
          <GameCanvas
            ref={canvasRef}
            fruitSet={activeFruitSet}
            nextDef={currentDef}
            onMerge={handleMerge}
            onGameOver={handleGameOver}
            onTap={handleTap}
            width={WORLD_W}
            height={WORLD_H}
            scale={scale}
          />
        )}
      </View>

      {gameOver && <GameOverOverlay score={score} onRestart={handleRestart} />}
    </View>
  );
}

export default function CascadeScreen() {
  return (
    <FruitSetProvider>
      <CascadeGame />
    </FruitSetProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 8,
  },
  canvasOuter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
    backgroundColor: "rgba(31,31,38,0.4)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    overflow: "hidden",
  },
});
