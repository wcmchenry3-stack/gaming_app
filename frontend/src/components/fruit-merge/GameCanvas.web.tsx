/**
 * GameCanvas — web platform
 * Rendered via HTML Canvas 2D API.
 * Metro automatically uses this file on web; GameCanvas.tsx is used on native.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { View, AccessibilityInfo } from "react-native";
import { Asset } from "expo-asset";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Matter from "matter-js";
import {
  createEngine,
  dropFruit,
  FruitBody,
  BodySnapshot,
  MergeEvent,
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
} from "../../game/fruit-merge/engine";
import { FruitDefinition, FruitSet } from "../../theme/fruitSets";
import { useTheme } from "../../theme/ThemeContext";
import { useTranslation } from "react-i18next";

const DROP_Y = 30;

export interface GameCanvasHandle {
  drop: (def: FruitDefinition, x: number) => void;
  reset: () => void;
  announceEvent: (message: string) => void;
}

interface Props {
  fruitSet: FruitSet;
  nextDef: FruitDefinition;
  onMerge: (event: MergeEvent) => void;
  onGameOver: () => void;
  onTap: (x: number) => void;
  width: number;
  height: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function drawFruitBody(
  ctx: CanvasRenderingContext2D,
  def: FruitDefinition,
  x: number,
  y: number,
  angle: number,
  image: HTMLImageElement | null
) {
  const r = def.radius;
  if (image && image.complete && image.naturalWidth > 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.drawImage(image, -r, -r, r * 2, r * 2);
    ctx.restore();
  } else {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

const GameCanvas = forwardRef<GameCanvasHandle, Props>(
  ({ fruitSet, nextDef, onMerge, onGameOver, onTap, width, height }, ref) => {
    const { colors } = useTheme();
    const { t } = useTranslation("fruit-merge");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
    const onMergeRef = useRef(onMerge);
    const onGameOverRef = useRef(onGameOver);
    const fruitSetRef = useRef(fruitSet);
    const colorsRef = useRef(colors);
    const nextDefRef = useRef(nextDef);
    const bodiesRef = useRef<BodySnapshot[]>([]);
    const pointerXRef = useRef<number | null>(null);
    const htmlImagesRef = useRef<(HTMLImageElement | null)[]>([]);

    useEffect(() => {
      onMergeRef.current = onMerge;
    }, [onMerge]);
    useEffect(() => {
      onGameOverRef.current = onGameOver;
    }, [onGameOver]);
    useEffect(() => {
      fruitSetRef.current = fruitSet;
    }, [fruitSet]);
    useEffect(() => {
      colorsRef.current = colors;
    }, [colors]);
    useEffect(() => {
      nextDefRef.current = nextDef;
    }, [nextDef]);

    // Load HTMLImageElements for the current fruit set via expo-asset
    useEffect(() => {
      const fruits = fruitSet.fruits;
      const images: (HTMLImageElement | null)[] = new Array(fruits.length).fill(null);
      htmlImagesRef.current = images;
      let cancelled = false;

      (async () => {
        await Promise.all(
          fruits.map(async (def, i) => {
            if (!def.icon) return;
            try {
              const asset = Asset.fromModule(def.icon as number);
              await asset.downloadAsync();
              const uri = asset.localUri ?? asset.uri;
              if (!uri || cancelled) return;
              await new Promise<void>((resolve) => {
                const img = new window.Image();
                img.src = uri;
                img.onload = () => {
                  if (!cancelled) images[i] = img;
                  resolve();
                };
                img.onerror = () => resolve();
              });
            } catch {
              // Image failed to load — colored circle fallback stays
            }
          })
        );
      })();

      return () => {
        cancelled = true;
      };
    }, [fruitSet]);

    // Stable draw function — reads everything from refs to avoid recreating the RAF loop
    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const c = colorsRef.current;
      const nd = nextDefRef.current;
      const fs = fruitSetRef.current;
      const dangerY = height * DANGER_LINE_RATIO;

      ctx.clearRect(0, 0, width, height);

      // Background
      ctx.fillStyle = c.fruitBackground;
      ctx.fillRect(0, 0, width, height);

      // Walls
      ctx.fillStyle = c.border;
      ctx.fillRect(0, 0, WALL_THICKNESS, height);
      ctx.fillRect(width - WALL_THICKNESS, 0, WALL_THICKNESS, height);
      ctx.fillRect(0, height - WALL_THICKNESS, width, WALL_THICKNESS);

      // Danger line
      ctx.save();
      ctx.strokeStyle = "rgba(239,68,68,0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(WALL_THICKNESS, dangerY);
      ctx.lineTo(width - WALL_THICKNESS, dangerY);
      ctx.stroke();
      ctx.restore();

      // Ghost fruit + guide line
      const pointerX = pointerXRef.current;
      if (pointerX !== null) {
        const ghostCx = clamp(
          pointerX,
          WALL_THICKNESS + nd.radius,
          width - WALL_THICKNESS - nd.radius
        );
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = "rgba(255,255,255,0.12)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(ghostCx, dangerY);
        ctx.lineTo(ghostCx, height - WALL_THICKNESS);
        ctx.stroke();
        drawFruitBody(
          ctx,
          nd,
          ghostCx,
          DROP_Y,
          0, // ghost has no rotation
          htmlImagesRef.current[nd.tier] ?? null
        );
        ctx.restore();
      }

      // Physics bodies
      for (const body of bodiesRef.current) {
        const def = fs.fruits[body.tier];
        if (!def) continue;
        drawFruitBody(
          ctx,
          def,
          body.x,
          body.y,
          body.angle,
          htmlImagesRef.current[body.tier] ?? null
        );
      }
    }, [width, height]); // width/height trigger engine reset anyway, so deps here are stable

    // Keep latest draw in a ref so the RAF loop never needs to be torn down
    const drawRef = useRef(draw);
    useEffect(() => {
      drawRef.current = draw;
    }, [draw]);

    const initEngine = useCallback(() => {
      engineRef.current?.cleanup();
      engineRef.current = createEngine(
        width,
        height,
        fruitSet,
        (e) => onMergeRef.current(e),
        () => onGameOverRef.current()
      );
      const { engine } = engineRef.current;
      Matter.Events.on(engine, "afterUpdate", () => {
        bodiesRef.current = Matter.Composite.allBodies(engine.world)
          .filter((b) => !(b as FruitBody).isStatic && (b as FruitBody).fruitTier !== undefined)
          .map((b) => ({
            id: b.id,
            x: b.position.x,
            y: b.position.y,
            tier: (b as FruitBody).fruitTier,
            angle: b.angle,
          }));
      });
      bodiesRef.current = [];
    }, [width, height, fruitSet]);

    useEffect(() => {
      initEngine();
      return () => {
        engineRef.current?.cleanup();
      };
    }, [initEngine]);

    // Single long-lived RAF loop
    useEffect(() => {
      let id: number;
      function loop() {
        drawRef.current();
        id = requestAnimationFrame(loop);
      }
      id = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(id);
    }, []); // intentionally empty — loop lives for component lifetime

    useImperativeHandle(
      ref,
      () => ({
        drop(def, x) {
          if (!engineRef.current) return;
          const clamped = clamp(
            x,
            WALL_THICKNESS + def.radius,
            width - WALL_THICKNESS - def.radius
          );
          dropFruit(engineRef.current.world, def, fruitSetRef.current.id, clamped, DROP_Y);
        },
        reset() {
          initEngine();
        },
        announceEvent(message) {
          AccessibilityInfo.announceForAccessibility(message);
        },
      }),
      [initEngine, width]
    );

    const tapGesture = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, ok) => {
        if (ok) onTap(e.x);
      });
    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => {
        pointerXRef.current = e.x;
      })
      .onChange((e) => {
        pointerXRef.current = e.x;
      })
      .onFinalize(() => {
        pointerXRef.current = null;
      });
    const composed = Gesture.Simultaneous(tapGesture, panGesture);

    return (
      <GestureDetector gesture={composed}>
        <View
          style={{ width, height, borderRadius: 12, overflow: "hidden" }}
          accessibilityLabel={t("game.canvasLabel")}
          accessibilityRole="none"
        >
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            style={{ display: "block", borderRadius: 12 }}
          />
        </View>
      </GestureDetector>
    );
  }
);

GameCanvas.displayName = "GameCanvas";
export default GameCanvas;
