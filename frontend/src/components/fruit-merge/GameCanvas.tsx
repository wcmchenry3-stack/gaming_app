import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from "react";
import { View, StyleSheet } from "react-native";
import Matter from "matter-js";
import {
  createEngine,
  dropFruit,
  FruitBody,
  MergeEvent,
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
} from "../../game/fruit-merge/engine";
import { FruitSet, FruitDefinition } from "../../theme/fruitSets";
import { getAssetByID } from "@react-native/assets-registry/registry";
import { useTheme } from "../../theme/ThemeContext";
import { useTranslation } from "react-i18next";

export interface GameCanvasHandle {
  drop: (def: FruitDefinition, x: number) => void;
  reset: () => void;
  announceEvent: (message: string) => void;
}

interface Props {
  fruitSet: FruitSet;
  nextDef: FruitDefinition; // current fruit about to be dropped (for ghost indicator)
  onMerge: (event: MergeEvent) => void;
  onGameOver: () => void;
  onTap: (x: number) => void;
  width: number;
  height: number;
}

// Fruits spawn just inside the top of the container
const DROP_Y = 30;
const ICON_INSET_RATIO = 0.12;
const canvasImageCache = new Map<string, HTMLImageElement>();

// Resolve a canvas-drawable URI from an ImageSourcePropType icon.
// Metro (Expo Web) represents PNG imports as numbers (asset IDs).
// react-native-web's Image.resolveAssetSource returns null for numbers,
// so we query the @react-native/assets-registry directly to reconstruct
// the URL that Metro is already serving.
function resolveIconUri(icon: NonNullable<FruitDefinition["icon"]>): string | null {
  if (typeof icon === "string") return icon;
  if (typeof icon === "object" && "uri" in icon) return (icon as { uri: string }).uri;
  if (typeof icon === "number") {
    try {
      const asset = getAssetByID(icon);
      if (!asset) return null;
      return `${window.location.origin}${asset.httpServerLocation}/${asset.name}.${asset.type}`;
    } catch {
      return null;
    }
  }
  return null;
}

function getCanvasImage(def: FruitDefinition): HTMLImageElement | null {
  if (!def.icon || typeof window === "undefined") return null;
  try {
    const uri = resolveIconUri(def.icon);
    if (!uri) return null;

    const cached = canvasImageCache.get(uri);
    if (cached) return cached;

    const image = new window.Image();
    image.onerror = () => canvasImageCache.delete(uri); // evict on failure so next frame retries
    image.src = uri;
    canvasImageCache.set(uri, image);
    return image;
  } catch {
    // resolveAssetSource can throw in Expo Web if the asset registry isn't populated
    return null; // fall through to emoji in drawFruitVisual
  }
}

function drawFruitVisual(
  ctx: CanvasRenderingContext2D,
  def: FruitDefinition,
  x: number,
  y: number,
  radius: number
) {
  const image = getCanvasImage(def);
  // naturalWidth > 0 confirms the image loaded successfully (complete=true on broken images too)
  if (image?.complete && image.naturalWidth > 0) {
    const diameter = radius * 2;
    const inset = diameter * ICON_INSET_RATIO;
    const size = diameter - inset * 2;
    try {
      ctx.drawImage(image, x - size / 2, y - size / 2, size, size);
      return;
    } catch {
      // Image is in broken state — fall through to emoji
    }
  }

  ctx.font = `${Math.round(radius * 1.1)}px serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(def.emoji, x, y);
}

const GameCanvas = forwardRef<GameCanvasHandle, Props>(
  ({ fruitSet, nextDef, onMerge, onGameOver, onTap, width, height }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<ReturnType<typeof createEngine> | null>(null);
    const rafRef = useRef<number>(0);
    const pointerXRef = useRef<number | null>(null);
    const { colors } = useTheme();
    const { t } = useTranslation("fruit-merge");

    // Refs for props that change frequently — prevent engine re-creation
    const nextDefRef = useRef(nextDef);
    const onMergeRef = useRef(onMerge);
    const onGameOverRef = useRef(onGameOver);
    const onTapRef = useRef(onTap);
    const fruitSetRef = useRef(fruitSet);

    useEffect(() => {
      nextDefRef.current = nextDef;
    }, [nextDef]);
    useEffect(() => {
      onMergeRef.current = onMerge;
    }, [onMerge]);
    useEffect(() => {
      onGameOverRef.current = onGameOver;
    }, [onGameOver]);
    useEffect(() => {
      onTapRef.current = onTap;
    }, [onTap]);
    useEffect(() => {
      fruitSetRef.current = fruitSet;
    }, [fruitSet]);

    // initEngine only re-runs when canvas dimensions or fruit skin changes.
    // Callbacks (onMerge, onGameOver, onTap, nextDef) are accessed via refs.
    const initEngine = useCallback(() => {
      if (!canvasRef.current) return;

      if (engineRef.current) {
        engineRef.current.cleanup();
        cancelAnimationFrame(rafRef.current);
      }

      const canvas = canvasRef.current;
      canvas.width = width;
      canvas.height = height;

      engineRef.current = createEngine(
        width,
        height,
        fruitSetRef.current,
        (e) => onMergeRef.current(e),
        () => onGameOverRef.current()
      );

      const ctx = canvas.getContext("2d")!;
      const { engine } = engineRef.current;
      const dangerY = height * DANGER_LINE_RATIO;

      function renderFrame() {
        ctx.clearRect(0, 0, width, height);

        // --- Walls ---
        ctx.fillStyle = colors.border;
        ctx.fillRect(0, 0, WALL_THICKNESS, height); // left
        ctx.fillRect(width - WALL_THICKNESS, 0, WALL_THICKNESS, height); // right
        ctx.fillRect(0, height - WALL_THICKNESS, width, WALL_THICKNESS); // floor

        // --- Danger line ---
        ctx.save();
        ctx.strokeStyle = "rgba(239,68,68,0.4)";
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(WALL_THICKNESS, dangerY);
        ctx.lineTo(width - WALL_THICKNESS, dangerY);
        ctx.stroke();
        ctx.restore();

        // --- Drop indicator (ghost + guide line) ---
        const px = pointerXRef.current;
        const nd = nextDefRef.current;
        if (px !== null) {
          const clamped = Math.max(
            WALL_THICKNESS + nd.radius,
            Math.min(width - WALL_THICKNESS - nd.radius, px)
          );
          // Vertical guide
          ctx.save();
          ctx.strokeStyle = "rgba(255,255,255,0.12)";
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 6]);
          ctx.beginPath();
          ctx.moveTo(clamped, dangerY);
          ctx.lineTo(clamped, height - WALL_THICKNESS);
          ctx.stroke();
          ctx.restore();

          // Ghost fruit
          ctx.save();
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.arc(clamped, DROP_Y, nd.radius, 0, Math.PI * 2);
          ctx.fillStyle = nd.color;
          ctx.fill();
          drawFruitVisual(ctx, nd, clamped, DROP_Y, nd.radius);
          ctx.restore();
        }

        // --- Fruit bodies ---
        const bodies = Matter.Composite.allBodies(engine.world);
        for (const body of bodies) {
          if (body.isStatic) continue;
          const fb = body as FruitBody;
          const def = fruitSetRef.current.fruits[fb.fruitTier];
          if (!def) continue;

          const { x, y } = body.position;
          const r = def.radius;

          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fillStyle = def.color;
          ctx.fill();
          drawFruitVisual(ctx, def, x, y, r);
        }

        rafRef.current = requestAnimationFrame(renderFrame);
      }

      rafRef.current = requestAnimationFrame(renderFrame);
    }, [width, height, colors.border]); // fruitSet skin switch is handled via reset() in FruitMergeScreen

    // Canvas native event listeners — avoids React Native Pressable layout issues on web
    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const onClick = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        onTapRef.current(e.clientX - rect.left);
      };
      const onPointerMove = (e: PointerEvent) => {
        const rect = canvas.getBoundingClientRect();
        pointerXRef.current = e.clientX - rect.left;
      };
      const onPointerLeave = () => {
        pointerXRef.current = null;
      };
      const onTouchEnd = (e: TouchEvent) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const t = e.changedTouches[0];
        if (t) onTapRef.current(t.clientX - rect.left);
      };

      canvas.addEventListener("click", onClick);
      canvas.addEventListener("pointermove", onPointerMove);
      canvas.addEventListener("pointerleave", onPointerLeave);
      canvas.addEventListener("touchend", onTouchEnd, { passive: false });
      return () => {
        canvas.removeEventListener("click", onClick);
        canvas.removeEventListener("pointermove", onPointerMove);
        canvas.removeEventListener("pointerleave", onPointerLeave);
        canvas.removeEventListener("touchend", onTouchEnd);
      };
    }, []); // listeners never need to be re-registered — they read from refs

    useEffect(() => {
      initEngine();
      return () => {
        engineRef.current?.cleanup();
        cancelAnimationFrame(rafRef.current);
      };
    }, [initEngine]);

    useImperativeHandle(
      ref,
      () => ({
        drop(def: FruitDefinition, x: number) {
          if (!engineRef.current) return;
          const clamped = Math.max(
            WALL_THICKNESS + def.radius,
            Math.min(width - WALL_THICKNESS - def.radius, x)
          );
          dropFruit(engineRef.current.world, def, fruitSetRef.current.id, clamped, DROP_Y);
        },
        reset() {
          initEngine();
        },
        announceEvent(message: string) {
          const el = document.getElementById("fruit-merge-announcer");
          if (el) {
            // Clear first so re-announcing the same string still triggers the live region
            el.textContent = "";
            requestAnimationFrame(() => {
              el.textContent = message;
            });
          }
        },
      }),
      [initEngine, width]
    );

    return (
      <View style={[styles.wrapper, { width, height, backgroundColor: colors.fruitBackground }]}>
        {/* @ts-expect-error — canvas is a valid DOM element in Expo Web */}
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          aria-label={t("game.canvasLabel")}
          role="application"
          style={{ display: "block", cursor: "crosshair" }}
        />
        {/* Visually hidden live region — narrates merge events and game-over for screen readers */}
        {/* @ts-expect-error — div is a valid DOM element in Expo Web */}
        <div
          id="fruit-merge-announcer"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "absolute",
            left: -9999,
            width: 1,
            height: 1,
            overflow: "hidden",
          }}
        />
      </View>
    );
  }
);

GameCanvas.displayName = "GameCanvas";
export default GameCanvas;

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    overflow: "hidden",
  },
});
