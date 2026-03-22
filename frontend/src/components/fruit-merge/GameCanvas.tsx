import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import Matter from "matter-js";
import { createEngine, dropFruit, FruitBody, MergeEvent, WALL_THICKNESS } from "../../game/fruit-merge/engine";
import { FruitSet, FruitDefinition } from "../../theme/fruitSets";
import { useTheme } from "../../theme/ThemeContext";

export interface GameCanvasHandle {
  drop: (def: FruitDefinition, x: number) => void;
  reset: () => void;
}

interface Props {
  fruitSet: FruitSet;
  onMerge: (event: MergeEvent) => void;
  onGameOver: () => void;
  width: number;
  height: number;
}

const DROP_Y = 40; // px from top where fruits spawn

const GameCanvas = forwardRef<GameCanvasHandle, Props>(
  ({ fruitSet, onMerge, onGameOver, width, height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
    const rafRef = useRef<number>(0);
    const { colors } = useTheme();

    const initEngine = useCallback(() => {
      if (!canvasRef.current) return;
      if (engineRef.current) {
        engineRef.current.cleanup();
        cancelAnimationFrame(rafRef.current);
      }

      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;

      engineRef.current = createEngine(canvas, fruitSet, onMerge, onGameOver);

      const ctx = canvas.getContext("2d")!;
      const { engine } = engineRef.current;

      function renderFrame() {
        ctx.clearRect(0, 0, width, height);

        // Draw container walls
        ctx.fillStyle = colors.border;
        ctx.fillRect(0, 0, WALL_THICKNESS, height);                    // left
        ctx.fillRect(width - WALL_THICKNESS, 0, WALL_THICKNESS, height); // right
        ctx.fillRect(0, height - WALL_THICKNESS, width, WALL_THICKNESS);  // floor

        // Danger line
        ctx.strokeStyle = "rgba(239,68,68,0.25)";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(WALL_THICKNESS, height * 0.1);
        ctx.lineTo(width - WALL_THICKNESS, height * 0.1);
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw each fruit body
        for (const body of engine.world.bodies) {
          if (body.isStatic) continue;
          const fb = body as FruitBody;
          const def = fruitSet.fruits[fb.fruitTier];
          if (!def) continue;

          const { x, y } = body.position;
          const r = def.radius;

          // Circle fill
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = def.color;
          ctx.fill();

          // Emoji
          ctx.font = `${Math.round(r * 1.1)}px serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(def.emoji, x, y);
        }

        rafRef.current = requestAnimationFrame(renderFrame);
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    }, [width, height, fruitSet, onMerge, onGameOver, colors.border]);

    useEffect(() => {
      initEngine();
      return () => {
        engineRef.current?.cleanup();
        cancelAnimationFrame(rafRef.current);
      };
    }, [initEngine]);

    useImperativeHandle(ref, () => ({
      drop(def: FruitDefinition, x: number) {
        if (!engineRef.current) return;
        const clampedX = Math.max(
          WALL_THICKNESS + def.radius,
          Math.min(width - WALL_THICKNESS - def.radius, x),
        );
        dropFruit(engineRef.current.world, def, fruitSet.id, clampedX, DROP_Y);
      },
      reset() {
        initEngine();
      },
    }));

    return (
      <View style={[styles.wrapper, { width, height, backgroundColor: colors.surface }]}>
        {/* @ts-ignore — canvas is valid DOM element in Expo Web */}
        <canvas ref={canvasRef} width={width} height={height} style={styles.canvas} />
      </View>
    );
  },
);

GameCanvas.displayName = "GameCanvas";
export default GameCanvas;

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    overflow: "hidden",
  },
  canvas: {
    display: "block",
  },
});
