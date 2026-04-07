/**
 * GameCanvas — web platform
 * Rendered via HTML Canvas 2D API.
 * Metro automatically uses this file on web; GameCanvas.tsx is used on native.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { View, AccessibilityInfo } from "react-native";
import { Asset } from "expo-asset";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import {
  createEngine,
  EngineHandle,
  BodySnapshot,
  MergeEvent,
  WALL_THICKNESS,
  DANGER_LINE_RATIO,
  BoundaryEscapeEvent,
} from "../../game/cascade/engine";
import * as Sentry from "@sentry/react-native";
import { FruitDefinition, FruitSet } from "../../theme/fruitSets";
import { getSpriteInfo, spriteClipRadius, SpriteInfo } from "../../game/cascade/fruitVertices";
import { useTheme } from "../../theme/ThemeContext";
import { useTranslation } from "react-i18next";

const DROP_Y = 30;

/**
 * Debug flag: when true, draws collision polygon outlines over each fruit.
 * Toggle to visualise the mismatch between visual sprite edges and physics
 * boundaries (see GitHub issue #121).
 */
const DEBUG_COLLISION = __DEV__;

export interface CascadeEngineState {
  fruitCount: number;
  dangerRatio: number;
  fruits: Array<{ id: number; tier: number; x: number; y: number }>;
}

export interface GameCanvasHandle {
  drop: (def: FruitDefinition, x: number) => void;
  reset: () => void;
  announceEvent: (message: string) => void;
  /** Only populated when EXPO_PUBLIC_TEST_HOOKS=1 */
  getEngineState?: () => CascadeEngineState;
  fastForward?: (ms: number) => void;
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

/** Strip semi-transparent glow/shadow pixels from a loaded image.
 *  Planet PNGs have bright RGB data in their zero-alpha pixels; downsampling
 *  would blend these with adjacent opaque pixels, resurrecting them as a
 *  visible checkerboard. We process at full resolution to avoid this. */
function cleanImage(img: HTMLImageElement): CanvasImageSource {
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, w, h);
    const px = data.data;
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 200) {
        // Zero out RGBA entirely — prevents RGB bleed on later resampling
        px[i] = 0;
        px[i + 1] = 0;
        px[i + 2] = 0;
        px[i + 3] = 0;
      }
    }
    ctx.putImageData(data, 0, 0);
    return c;
  } catch (e) {
    console.warn("cleanImage failed:", e);
    return img;
  }
}

function drawFruitBody(
  ctx: CanvasRenderingContext2D,
  def: FruitDefinition,
  x: number,
  y: number,
  angle: number,
  image: CanvasImageSource | null,
  bgColor: string,
  sprite: SpriteInfo | null
) {
  const r = def.radius;
  const imgW = (image as HTMLCanvasElement | null)?.width ?? 0;
  if (image && imgW > 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    // Clip to the sprite's full bounding circle so ring imagery on ringed
    // planets (Uranus, Saturn) is not truncated at the physics radius.
    // For sprites without an extended bounding rect this equals r exactly.
    const clipR = sprite ? spriteClipRadius(sprite, r) : r;
    ctx.beginPath();
    ctx.arc(0, 0, clipR, 0, Math.PI * 2);
    ctx.clip();
    // Opaque bg fill first — anything transparent in the sprite shows this
    ctx.fillStyle = bgColor;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    if (sprite) {
      const ix = sprite.offsetX * r;
      const iy = sprite.offsetY * r;
      const sw = sprite.scaleX * r;
      const sh = sprite.scaleY * r;
      ctx.drawImage(image, ix - sw, iy - sh, sw * 2, sh * 2);
    } else {
      ctx.drawImage(image, -r, -r, r * 2, r * 2);
    }
    ctx.restore();
  } else {
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCollisionOverlay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  radius: number,
  verts: { x: number; y: number }[] | null
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);

  if (verts && verts.length >= 3) {
    // Draw the actual polygon collider
    ctx.beginPath();
    ctx.moveTo(verts[0].x * radius, verts[0].y * radius);
    for (let i = 1; i < verts.length; i++) {
      ctx.lineTo(verts[i].x * radius, verts[i].y * radius);
    }
    ctx.closePath();
    ctx.strokeStyle = "rgba(0,255,0,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(0,255,0,0.1)";
    ctx.fill();
  } else {
    // Circle fallback collider
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,0,0.8)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "rgba(255,255,0,0.1)";
    ctx.fill();
  }

  ctx.restore();
}

const GameCanvas = forwardRef<GameCanvasHandle, Props>(
  ({ fruitSet, nextDef, onMerge, onGameOver, onTap, width, height }, ref) => {
    const { colors } = useTheme();
    const { t } = useTranslation("cascade");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const engineRef = useRef<EngineHandle | null>(null);
    const onMergeRef = useRef(onMerge);
    const onGameOverRef = useRef(onGameOver);
    const fruitSetRef = useRef(fruitSet);
    const colorsRef = useRef(colors);
    const nextDefRef = useRef(nextDef);
    const bodiesRef = useRef<BodySnapshot[]>([]);
    const pointerXRef = useRef<number | null>(null);
    const htmlImagesRef = useRef<(CanvasImageSource | null)[]>([]);
    const spriteInfoRef = useRef<(SpriteInfo | null)[]>([]);
    const lastFrameTimeRef = useRef<number>(0); // tracks last RAF timestamp for elapsed-time physics

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
      const images: (CanvasImageSource | null)[] = new Array(fruits.length).fill(null);
      htmlImagesRef.current = images;
      // Precompute sprite rendering info for each tier
      spriteInfoRef.current = fruits.map((def) => {
        const nameKey = (def as { nameKey?: string }).nameKey ?? def.name.toLowerCase();
        return getSpriteInfo(fruitSet.id, nameKey);
      });
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
                img.crossOrigin = "anonymous";
                img.src = uri;
                img.onload = () => {
                  if (!cancelled) images[i] = cleanImage(img);
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
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = "rgba(255,255,255,0.25)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 6]);
        ctx.beginPath();
        ctx.moveTo(ghostCx, dangerY);
        ctx.lineTo(ghostCx, height - WALL_THICKNESS);
        ctx.stroke();
        // Drop shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath();
        ctx.arc(ghostCx + 2, DROP_Y + 3, nd.radius + 1, 0, Math.PI * 2);
        ctx.fill();
        drawFruitBody(
          ctx,
          nd,
          ghostCx,
          DROP_Y,
          0, // ghost has no rotation
          htmlImagesRef.current[nd.tier] ?? null,
          c.fruitBackground,
          spriteInfoRef.current[nd.tier] ?? null
        );
        ctx.restore();
      }

      // Physics bodies — sorted by Y so lower fruits draw on top of higher ones
      const bodies = [...bodiesRef.current].sort((a, b) => a.y - b.y);
      for (const body of bodies) {
        const def = fs.fruits[body.tier];
        if (!def) continue;
        drawFruitBody(
          ctx,
          def,
          body.x,
          body.y,
          body.angle,
          htmlImagesRef.current[body.tier] ?? null,
          c.fruitBackground,
          spriteInfoRef.current[body.tier] ?? null
        );
        if (DEBUG_COLLISION) {
          drawCollisionOverlay(ctx, body.x, body.y, body.angle, def.radius, body.collisionVerts);
        }
      }

      // Redraw walls on top so bin edges are always in front of fruit sprites
      ctx.fillStyle = c.border;
      ctx.fillRect(0, 0, WALL_THICKNESS, height);
      ctx.fillRect(width - WALL_THICKNESS, 0, WALL_THICKNESS, height);
      ctx.fillRect(0, height - WALL_THICKNESS, width, WALL_THICKNESS);
    }, [width, height]); // width/height trigger engine reset anyway, so deps here are stable

    // Keep latest draw in a ref so the RAF loop never needs to be torn down
    const drawRef = useRef(draw);
    useEffect(() => {
      drawRef.current = draw;
    }, [draw]);

    const initEngine = useCallback(async () => {
      engineRef.current?.cleanup();
      engineRef.current = null;
      bodiesRef.current = [];
      engineRef.current = await createEngine(
        width,
        height,
        fruitSet,
        (e) => onMergeRef.current(e),
        () => onGameOverRef.current(),
        (escape: BoundaryEscapeEvent) => {
          Sentry.captureMessage("Cascade: fruit escaped boundary", {
            level: "warning",
            extra: {
              tier: escape.tier,
              x: Math.round(escape.x),
              y: Math.round(escape.y),
              canvasWidth: escape.width,
              canvasHeight: escape.height,
            },
          });
        }
      );
    }, [width, height, fruitSet]);

    useEffect(() => {
      initEngine();
      return () => {
        engineRef.current?.cleanup();
      };
    }, [initEngine]);

    // Debug: keyboard shortcuts to spawn any tier fruit (0-9, 'q' for tier 10)
    useEffect(() => {
      if (!DEBUG_COLLISION) return;
      function onKey(e: KeyboardEvent) {
        const engine = engineRef.current;
        const fs = fruitSetRef.current;
        if (!engine || !fs) return;
        let tier = -1;
        if (e.key >= "0" && e.key <= "9") tier = parseInt(e.key, 10);
        else if (e.key === "q" || e.key === "Q") tier = 10;
        else return;
        const def = fs.fruits[tier];
        if (!def) return;
        const spawnX =
          WALL_THICKNESS +
          def.radius +
          Math.random() * (width - 2 * WALL_THICKNESS - 2 * def.radius);
        engine.drop(def, fs.id, spawnX, DROP_Y);
      }
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }, [width]);

    // Single long-lived RAF loop: steps physics then draws.
    // Uses the RAF timestamp to compute elapsed time so physics runs at real
    // wall-clock speed regardless of display refresh rate (60 Hz, 120 Hz, etc.).
    useEffect(() => {
      let id: number;
      function loop(timestamp: number) {
        if (lastFrameTimeRef.current === 0) lastFrameTimeRef.current = timestamp;
        const elapsed = (timestamp - lastFrameTimeRef.current) / 1000; // seconds
        lastFrameTimeRef.current = timestamp;
        if (engineRef.current) {
          bodiesRef.current = engineRef.current.step(elapsed);
        }
        drawRef.current();
        id = requestAnimationFrame(loop);
      }
      id = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(id);
    }, []); // intentionally empty — loop lives for component lifetime

    useImperativeHandle(ref, () => {
      const base: GameCanvasHandle = {
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
      };

      if (process.env.EXPO_PUBLIC_TEST_HOOKS !== "1") return base;

      return {
        ...base,
        getEngineState(): CascadeEngineState {
          const bodies = bodiesRef.current;
          const dangerY = height * DANGER_LINE_RATIO;
          let dangerRatio = 0;
          if (bodies.length > 0) {
            const minTopY = Math.min(
              ...bodies.map((b) => b.y - (fruitSetRef.current.fruits[b.tier]?.radius ?? 0))
            );
            dangerRatio = Math.max(0, Math.min(1, 1 - minTopY / dangerY));
          }
          return {
            fruitCount: bodies.length,
            dangerRatio,
            fruits: bodies.map((b) => ({
              id: b.id,
              tier: b.tier,
              x: Math.round(b.x),
              y: Math.round(b.y),
            })),
          };
        },
        fastForward(ms: number) {
          if (!engineRef.current) return;
          const STEP_S = 1 / 60; // ~16.67 ms per step
          const steps = Math.ceil(ms / (STEP_S * 1000));
          for (let i = 0; i < steps; i++) {
            bodiesRef.current = engineRef.current.step(STEP_S);
          }
          drawRef.current();
        },
      };
    }, [initEngine, width, height]);

    const panGesture = Gesture.Pan()
      .runOnJS(true)
      .minDistance(0)
      .onBegin((e) => {
        pointerXRef.current = e.x;
      })
      .onChange((e) => {
        pointerXRef.current = e.x;
      })
      .onEnd((e) => {
        if (pointerXRef.current !== null) onTap(e.x);
      })
      .onFinalize(() => {
        pointerXRef.current = null;
      });
    const tapGesture = Gesture.Tap()
      .runOnJS(true)
      .onEnd((e, ok) => {
        if (ok) onTap(e.x);
      });
    const composed = Gesture.Exclusive(panGesture, tapGesture);

    return (
      <GestureDetector gesture={composed}>
        <View
          style={{ width, height, borderRadius: 12, overflow: "hidden" }}
          accessibilityLabel={t("game.canvasLabel")}
          accessibilityRole="image"
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
