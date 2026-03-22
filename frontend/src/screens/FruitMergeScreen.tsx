import React, { useCallback, useRef, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, LayoutChangeEvent,
} from "react-native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../../App";
import { useTheme } from "../theme/ThemeContext";
import { FruitSetProvider, useFruitSet } from "../theme/FruitSetContext";
import { FruitQueue } from "../game/fruit-merge/fruitQueue";
import { MergeEvent } from "../game/fruit-merge/engine";
import { scoreForMerge } from "../game/fruit-merge/scoring";
import GameCanvas, { GameCanvasHandle } from "../components/fruit-merge/GameCanvas";
import NextFruitPreview from "../components/fruit-merge/NextFruitPreview";
import ScoreDisplay from "../components/fruit-merge/ScoreDisplay";
import ThemeSelector from "../components/fruit-merge/ThemeSelector";
import GameOverOverlay from "../components/fruit-merge/GameOverOverlay";

type Props = {
  navigation: NativeStackNavigationProp<RootStackParamList, "FruitMerge">;
};

function FruitMergeGame({ navigation }: Props) {
  const { colors, theme, toggle } = useTheme();
  const { activeFruitSet } = useFruitSet();

  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [queueVersion, setQueueVersion] = useState(0);

  const canvasRef = useRef<GameCanvasHandle>(null);
  const queueRef = useRef(new FruitQueue());
  const droppingRef = useRef(false);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
  }, []);

  const handleMerge = useCallback((event: MergeEvent) => {
    setScore((s) => s + scoreForMerge(event.tier));
  }, []);

  const handleGameOver = useCallback(() => {
    setGameOver(true);
  }, []);

  function handleTap(x: number) {
    if (gameOver || droppingRef.current) return;
    droppingRef.current = true;

    const tier = queueRef.current.consume();
    queueRef.current; // trigger re-render via version bump
    setQueueVersion((v) => v + 1);

    const def = activeFruitSet.fruits[tier];
    canvasRef.current?.drop(def, x);

    // Brief cooldown to prevent rapid drops
    setTimeout(() => { droppingRef.current = false; }, 350);
  }

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

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.textMuted }]}>← Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Fruit Merge</Text>
        <Pressable onPress={toggle} style={styles.themeToggle}>
          <Text style={[styles.themeToggleText, { color: colors.textMuted }]}>
            {theme === "dark" ? "Light" : "Dark"}
          </Text>
        </Pressable>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <ScoreDisplay score={score} />
        <NextFruitPreview current={currentDef} next={nextDef} />
        <ThemeSelector />
      </View>

      {/* Canvas drop zone */}
      <View style={styles.canvasContainer} onLayout={onLayout}>
        {canvasSize.width > 0 && (
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={(e) => {
              const x = e.nativeEvent.locationX;
              handleTap(x);
            }}
          >
            <GameCanvas
              ref={canvasRef}
              fruitSet={activeFruitSet}
              onMerge={handleMerge}
              onGameOver={handleGameOver}
              width={canvasSize.width}
              height={canvasSize.height}
            />
          </Pressable>
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
    marginBottom: 12,
  },
  backBtn: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backText: {
    fontSize: 15,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
  },
  themeToggle: {
    paddingVertical: 6,
    paddingLeft: 12,
  },
  themeToggleText: {
    fontSize: 13,
  },
  controls: {
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  canvasContainer: {
    flex: 1,
    borderRadius: 12,
    overflow: "hidden",
  },
});
