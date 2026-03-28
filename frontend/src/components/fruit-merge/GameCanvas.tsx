/**
 * GameCanvas — native (iOS / Android)
 * Rendered via @shopify/react-native-skia.
 * Metro automatically uses GameCanvas.web.tsx on the web platform.
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { AccessibilityInfo } from "react-native";
import {
  Canvas,
  Circle,
  DashPathEffect,
  Fill,
  Group,
  Image as SkiaImage,
  Path,
  Rect,
  Skia,
} from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  createEngine,
  EngineHandle,
  BodySnapshot,
  MergeEvent,
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
} from "../../game/fruit-merge/engine";
import { FruitDefinition, FruitSet } from "../../theme/fruitSets";
import { useTheme } from "../../theme/ThemeContext";
import { useTranslation } from "react-i18next";
import { useFruitImages, getImagesForSet } from "../../theme/useFruitImages";

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

function FruitBodySkia({
  x,
  y,
  radius,
  color,
  image,
  angle,
}: {
  x: number;
  y: number;
  radius: number;
  color: string;
  image: SkImage | null;
  angle: number;
}) {
  if (image) {
    return (
      <Group transform={[{ translateX: x }, { translateY: y }, { rotate: angle }]}>
        <SkiaImage
          image={image}
          x={-radius}
          y={-radius}
          width={radius * 2}
          height={radius * 2}
          fit="contain"
        />
      </Group>
    );
  }
  return <Circle cx={x} cy={y} r={radius} color={color} />;
}

const GameCanvas = forwardRef<GameCanvasHandle, Props>(
  ({ fruitSet, nextDef, onMerge, onGameOver, onTap, width, height }, ref) => {
    const { colors } = useTheme();
    const { t } = useTranslation("fruit-merge");

    // Load all fruit/planet images via Skia (native only)
    const allImages = useFruitImages();
    const images = getImagesForSet(allImages, fruitSet.id);

    const [bodies, setBodies] = useState<BodySnapshot[]>([]);
    const [pointerX, setPointerX] = useState<number | null>(null);

    const engineRef = useRef<EngineHandle | null>(null);
    const onMergeRef = useRef(onMerge);
    const onGameOverRef = useRef(onGameOver);
    const fruitSetRef = useRef(fruitSet);

    useEffect(() => {
      onMergeRef.current = onMerge;
    }, [onMerge]);
    useEffect(() => {
      onGameOverRef.current = onGameOver;
    }, [onGameOver]);
    useEffect(() => {
      fruitSetRef.current = fruitSet;
    }, [fruitSet]);

    const initEngine = useCallback(async () => {
      engineRef.current?.cleanup();
      engineRef.current = null;
      setBodies([]);
      engineRef.current = await createEngine(
        width,
        height,
        fruitSet,
        (e) => onMergeRef.current(e),
        () => onGameOverRef.current()
      );
    }, [width, height, fruitSet]);

    useEffect(() => {
      initEngine();
      return () => {
        engineRef.current?.cleanup();
      };
    }, [initEngine]);

    // RAF loop drives physics steps and triggers re-renders
    useEffect(() => {
      let id: number;
      function loop() {
        if (engineRef.current) {
          setBodies(engineRef.current.step());
        }
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
          engineRef.current.drop(def, fruitSetRef.current.id, clamped, DROP_Y);
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

    const dangerY = height * DANGER_LINE_RATIO;

    const dangerPath = useMemo(() => {
      const p = Skia.Path.Make();
      p.moveTo(WALL_THICKNESS, dangerY);
      p.lineTo(width - WALL_THICKNESS, dangerY);
      return p;
    }, [width, dangerY]);

    const ghostCx =
      pointerX !== null
        ? clamp(pointerX, WALL_THICKNESS + nextDef.radius, width - WALL_THICKNESS - nextDef.radius)
        : null;

    const guidePath = useMemo(() => {
      if (ghostCx === null) return null;
      const p = Skia.Path.Make();
      p.moveTo(ghostCx, dangerY);
      p.lineTo(ghostCx, height - WALL_THICKNESS);
      return p;
    }, [ghostCx, dangerY, height]);

    const tapGesture = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, ok) => {
        if (ok) onTap(e.x);
      });
    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => setPointerX(e.x))
      .onChange((e) => setPointerX(e.x))
      .onFinalize(() => setPointerX(null));
    const composed = Gesture.Simultaneous(tapGesture, panGesture);

    return (
      <GestureDetector gesture={composed}>
        <Canvas
          style={{ width, height, borderRadius: 12, overflow: "hidden" }}
          accessibilityLabel={t("game.canvasLabel")}
          accessibilityRole="none"
        >
          <Fill color={colors.fruitBackground} />
          <Rect x={0} y={0} width={WALL_THICKNESS} height={height} color={colors.border} />
          <Rect
            x={width - WALL_THICKNESS}
            y={0}
            width={WALL_THICKNESS}
            height={height}
            color={colors.border}
          />
          <Rect
            x={0}
            y={height - WALL_THICKNESS}
            width={width}
            height={WALL_THICKNESS}
            color={colors.border}
          />
          <Path path={dangerPath} color="rgba(239,68,68,0.4)" style="stroke" strokeWidth={1}>
            <DashPathEffect intervals={[6, 4]} phase={0} />
          </Path>
          {ghostCx !== null && guidePath !== null && (
            <Group opacity={0.4}>
              <Path path={guidePath} color="rgba(255,255,255,0.12)" style="stroke" strokeWidth={1}>
                <DashPathEffect intervals={[4, 6]} phase={0} />
              </Path>
              <FruitBodySkia
                x={ghostCx}
                y={DROP_Y}
                radius={nextDef.radius}
                color={nextDef.color}
                image={images[nextDef.tier] ?? null}
                angle={0}
              />
            </Group>
          )}
          {bodies.map((body) => {
            const def = fruitSet.fruits[body.tier];
            if (!def) return null;
            return (
              <FruitBodySkia
                key={body.id}
                x={body.x}
                y={body.y}
                radius={def.radius}
                color={def.color}
                image={images[body.tier] ?? null}
                angle={body.angle}
              />
            );
          })}
        </Canvas>
      </GestureDetector>
    );
  }
);

GameCanvas.displayName = "GameCanvas";
export default GameCanvas;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
