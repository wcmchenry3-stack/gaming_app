import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, LayoutChangeEvent } from "react-native";
import { useTranslation } from "react-i18next";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { FruitSetProvider, useFruitSet } from "../theme/FruitSetContext";
import { FruitQueue } from "../game/fruit-merge/fruitQueue";
import { MergeEvent } from "../game/fruit-merge/engine";
import { scoreForMerge } from "../game/fruit-merge/scoring";
import GameCanvas, { GameCanvasHandle } from "../components/fruit-merge/GameCanvas";
import { useFruitImages, getImagesForSet } from "../theme/useFruitImages";
import NextFruitPreview from "../components/fruit-merge/NextFruitPreview";
import ScoreDisplay from "../components/fruit-merge/ScoreDisplay";
import ThemeSelector from "../components/fruit-merge/ThemeSelector";
import GameOverOverlay from "../components/fruit-merge/GameOverOverlay";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "FruitMerge">;
};

// Max container width — keeps the game portrait-shaped on wide screens
const MAX_CANVAS_WIDTH = 400;

function FruitMergeGame({ navigation }: Props) {
  const { t } = useTranslation(["fruit-merge", "common"]);
  const { colors, theme, toggle } = useTheme();
  const { activeFruitSet } = useFruitSet();

  const allImages = useFruitImages();
  const images = getImagesForSet(allImages, activeFruitSet.id);

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const [, setQueueVersion] = useState(0);

  const canvasRef = useRef<GameCanvasHandle>(null);
  const queueRef = useRef(new FruitQueue());
  const droppingRef = useRef(false);
  const prevFruitSetId = useRef(activeFruitSet.id);

  // Reset the engine when the player switches fruit set skin
  useEffect(() => {
    if (prevFruitSetId.current !== activeFruitSet.id) {
      prevFruitSetId.current = activeFruitSet.id;
      queueRef.current = new FruitQueue();
      setScore(0);
      setGameOver(false);
      setQueueVersion((v) => v + 1);
      canvasRef.current?.reset();
    }
  }, [activeFruitSet.id]);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setContainerWidth(Math.floor(width));
    setCanvasHeight(Math.floor(height));
  }, []);

  const handleMerge = useCallback(
    (event: MergeEvent) => {
      setScore((s) => s + scoreForMerge(event.tier));
      const merged = activeFruitSet.fruits[event.tier];
      if (merged) {
        canvasRef.current?.announceEvent(t("fruit-merge:event.merged", { fruit: merged.name }));
      }
    },
    [activeFruitSet, t]
  );

  const handleGameOver = useCallback(() => {
    canvasRef.current?.announceEvent(t("fruit-merge:event.gameOver"));
    setGameOver(true);
  }, [t]);

  const handleTap = useCallback(
    (x: number) => {
      if (gameOver || droppingRef.current) return;
      droppingRef.current = true;

      const tier = queueRef.current.consume();
      setQueueVersion((v) => v + 1);

      const def = activeFruitSet.fruits[tier];
      canvasRef.current?.drop(def, x);

      setTimeout(() => {
        droppingRef.current = false;
      }, 400);
    },
    [gameOver, activeFruitSet]
  );

  function handleRestart() {
    queueRef.current = new FruitQueue();
    setScore(0);
    setGameOver(false);
    setQueueVersion((v) => v + 1);
    canvasRef.current?.reset();
  }

  const queue = queueRef.current;
  const currentDef = activeFruitSet.fruits[queue.peek()];
  const nextDef = activeFruitSet.fruits[queue.peekNext()];

  // Clamp canvas width to MAX_CANVAS_WIDTH
  const canvasWidth = Math.min(containerWidth, MAX_CANVAS_WIDTH);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => navigation.goBack()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel={t("common:nav.backLabel")}
        >
          <Text style={[styles.backText, { color: colors.textMuted }]}>{t("common:nav.back")}</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
          {t("fruit-merge:game.title")}
        </Text>
        <Pressable
          onPress={toggle}
          style={styles.themeToggle}
          accessibilityRole="button"
          accessibilityLabel={t("common:theme.switchTo", {
            mode: theme === "dark" ? t("common:theme.light") : t("common:theme.dark"),
          })}
        >
          <Text style={[styles.themeToggleText, { color: colors.textMuted }]}>
            {theme === "dark" ? t("common:theme.lightShort") : t("common:theme.darkShort")}
          </Text>
        </Pressable>
      </View>

      {/* HUD */}
      <View style={styles.hud}>
        <ScoreDisplay score={score} />
        <NextFruitPreview current={currentDef} next={nextDef} />
      </View>

      <ThemeSelector />

      {/* Canvas — portrait-constrained, centered */}
      <View style={styles.canvasOuter} onLayout={onLayout}>
        {canvasWidth > 0 && canvasHeight > 0 && (
          <GameCanvas
            ref={canvasRef}
            fruitSet={activeFruitSet}
            nextDef={currentDef}
            onMerge={handleMerge}
            onGameOver={handleGameOver}
            onTap={handleTap}
            width={canvasWidth}
            height={canvasHeight}
            images={images}
          />
        )}
      </View>

      {gameOver && <GameOverOverlay score={score} onRestart={handleRestart} />}
    </View>
  );
}

export default function FruitMergeScreen(props: Props) {
  return (
    <FruitSetProvider>
      <FruitMergeGame {...props} />
    </FruitSetProvider>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  backBtn: { paddingVertical: 6, paddingRight: 12, minHeight: 44, justifyContent: "center" },
  backText: { fontSize: 15 },
  title: { fontSize: 20, fontWeight: "700" },
  themeToggle: { paddingVertical: 6, paddingLeft: 12, minHeight: 44, justifyContent: "center" },
  themeToggleText: { fontSize: 13 },
  hud: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginBottom: 8,
  },
  canvasOuter: {
    flex: 1,
    alignItems: "center", // centers the canvas horizontally when narrower than container
  },
});
