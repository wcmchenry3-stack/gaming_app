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
import Matter from "matter-js";
import {
  createEngine,
  dropFruit,
  FruitBody,
  MergeEvent,
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
} from "../../game/fruit-merge/engine";
import { FruitDefinition, FruitSet } from "../../theme/fruitSets";
import { useTheme } from "../../theme/ThemeContext";
import { useTranslation } from "react-i18next";

// Fruits spawn just inside the top of the container
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
  /** Images indexed by tier for the currently active fruit set. */
  images: (SkImage | null)[];
}

interface BodySnapshot {
  id: number;
  x: number;
  y: number;
  tier: number;
}

// ---------------------------------------------------------------------------
// FruitBodySkia — renders a single fruit as Skia JSX
// ---------------------------------------------------------------------------
interface FruitBodyProps {
  x: number;
  y: number;
  radius: number;
  color: string;
  image: SkImage | null;
  binBackground: string;
}

function FruitBodySkia({ x, y, radius, color, image, binBackground }: FruitBodyProps) {
  if (image) {
    return (
      <Group>
        {/* Background circle so PNG transparent areas show the bin colour */}
        <Circle cx={x} cy={y} r={radius} color={binBackground} />
        <SkiaImage
          image={image}
          x={x - radius}
          y={y - radius}
          width={radius * 2}
          height={radius * 2}
          fit="contain"
        />
      </Group>
    );
  }
  // Fallback: coloured circle (gems, or while image is still loading)
  return <Circle cx={x} cy={y} r={radius} color={color} />;
}

// ---------------------------------------------------------------------------
// GameCanvas
// ---------------------------------------------------------------------------
const GameCanvas = forwardRef<GameCanvasHandle, Props>(
  ({ fruitSet, nextDef, onMerge, onGameOver, onTap, width, height, images }, ref) => {
    const { colors } = useTheme();
    const { t } = useTranslation("fruit-merge");

    const [bodies, setBodies] = useState<BodySnapshot[]>([]);
    const [pointerX, setPointerX] = useState<number | null>(null);

    const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);

    // Stable refs for callbacks — engine re-creation is avoided on prop changes
    const nextDefRef = useRef(nextDef);
    const onMergeRef = useRef(onMerge);
    const onGameOverRef = useRef(onGameOver);
    const fruitSetRef = useRef(fruitSet);

    useEffect(() => { nextDefRef.current = nextDef; }, [nextDef]);
    useEffect(() => { onMergeRef.current = onMerge; }, [onMerge]);
    useEffect(() => { onGameOverRef.current = onGameOver; }, [onGameOver]);
    useEffect(() => { fruitSetRef.current = fruitSet; }, [fruitSet]);

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

      // Sync physics state into React state after each step so Skia re-draws
      Matter.Events.on(engine, "afterUpdate", () => {
        const snapshot: BodySnapshot[] = Matter.Composite.allBodies(engine.world)
          .filter(
            (b) =>
              !(b as FruitBody).isStatic &&
              (b as FruitBody).fruitTier !== undefined
          )
          .map((b) => ({
            id: b.id,
            x: b.position.x,
            y: b.position.y,
            tier: (b as FruitBody).fruitTier,
          }));
        setBodies(snapshot);
      });

      setBodies([]);
    }, [width, height, fruitSet]);

    useEffect(() => {
      initEngine();
      return () => { engineRef.current?.cleanup(); };
    }, [initEngine]);

    useImperativeHandle(
      ref,
      () => ({
        drop(def, x) {
          if (!engineRef.current) return;
          const clamped = clamp(x, WALL_THICKNESS + def.radius, width - WALL_THICKNESS - def.radius);
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

    // ----- Derived geometry -----
    const dangerY = height * DANGER_LINE_RATIO;

    const dangerPath = useMemo(() => {
      const p = Skia.Path.Make();
      p.moveTo(WALL_THICKNESS, dangerY);
      p.lineTo(width - WALL_THICKNESS, dangerY);
      return p;
    }, [width, dangerY]);

    // Ghost indicator — clamped drop position
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

    // ----- Gestures (run on JS thread — no Reanimated worklet needed) -----
    const tapGesture = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, success) => {
        if (success) onTap(e.x);
      });

    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .onBegin((e) => setPointerX(e.x))
      .onChange((e) => setPointerX(e.x))
      .onFinalize(() => setPointerX(null));

    const composed = Gesture.Simultaneous(tapGesture, panGesture);

    // ----- Render -----
    const ghostImage = images[nextDef.tier] ?? null;

    return (
      <GestureDetector gesture={composed}>
        <Canvas
          style={{ width, height, borderRadius: 12, overflow: "hidden" }}
          accessibilityLabel={t("game.canvasLabel")}
          accessibilityRole="none"
        >
          {/* Background */}
          <Fill color={colors.fruitBackground} />

          {/* Walls */}
          <Rect x={0} y={0} width={WALL_THICKNESS} height={height} color={colors.border} />
          <Rect x={width - WALL_THICKNESS} y={0} width={WALL_THICKNESS} height={height} color={colors.border} />
          <Rect x={0} y={height - WALL_THICKNESS} width={width} height={WALL_THICKNESS} color={colors.border} />

          {/* Danger line */}
          <Path path={dangerPath} color="rgba(239,68,68,0.4)" style="stroke" strokeWidth={1}>
            <DashPathEffect intervals={[6, 4]} phase={0} />
          </Path>

          {/* Ghost drop indicator */}
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
                image={ghostImage}
                binBackground={colors.fruitBackground}
              />
            </Group>
          )}

          {/* Live fruit bodies */}
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
                binBackground={colors.fruitBackground}
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
