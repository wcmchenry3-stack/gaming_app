import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import {
  Canvas,
  Circle,
  Fill,
  Group,
  Image as SkiaImage,
  Rect,
} from "@shopify/react-native-skia";
import { useTranslation } from "react-i18next";
import { initStarSwarm, tick } from "../../game/starswarm/engine";
import { initStarfield, tickStarfield } from "../../game/starswarm/starfield";
import type { StarfieldState } from "../../game/starswarm/starfield";
import { useStarSwarmImages } from "../../game/starswarm/assets";
import type { StarSwarmState } from "../../game/starswarm/types";

const EXPLOSION_DRAW_SIZE = 48;
const DT_CAP_MS = 33;
const INVINCIBLE_BLINK_INTERVAL = 120; // ms

export interface GameCanvasHandle {
  reset: () => void;
  setPlayerX: (x: number) => void;
  setFire: (fire: boolean) => void;
}

interface Props {
  highScore?: number;
  onGameOver?: (finalScore: number) => void;
  onScoreChange?: (score: number) => void;
  width: number;
  height: number;
  scale: number;
}

interface RenderState {
  game: StarSwarmState;
  sf: StarfieldState;
}

const GameCanvas = forwardRef<GameCanvasHandle, Props>(
  ({ highScore = 0, onGameOver, onScoreChange, width, height, scale }, ref) => {
    const { t } = useTranslation("starswarm");
    const images = useStarSwarmImages();

    const gameRef = useRef<StarSwarmState>(initStarSwarm(width, height));
    const sfRef = useRef<StarfieldState>(initStarfield(width, height));
    const inputRef = useRef({ playerX: width / 2, fire: true });
    const lastFrameTimeRef = useRef(0);
    const prevScoreRef = useRef(0);
    const onGameOverRef = useRef(onGameOver);
    const onScoreChangeRef = useRef(onScoreChange);

    useEffect(() => {
      onGameOverRef.current = onGameOver;
    }, [onGameOver]);
    useEffect(() => {
      onScoreChangeRef.current = onScoreChange;
    }, [onScoreChange]);

    const [renderState, setRenderState] = useState<RenderState>({
      game: gameRef.current,
      sf: sfRef.current,
    });

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          gameRef.current = initStarSwarm(width, height);
          sfRef.current = initStarfield(width, height);
          inputRef.current.playerX = width / 2;
          prevScoreRef.current = 0;
          setRenderState({ game: gameRef.current, sf: sfRef.current });
        },
        setPlayerX(x) {
          inputRef.current.playerX = x;
        },
        setFire(fire) {
          inputRef.current.fire = fire;
        },
      }),
      [width, height]
    );

    // RAF game loop — drives both engine tick and Skia re-renders
    useEffect(() => {
      let id: number;

      function loop(timestamp: number) {
        if (lastFrameTimeRef.current === 0) lastFrameTimeRef.current = timestamp;
        const dtMs = Math.min(timestamp - lastFrameTimeRef.current, DT_CAP_MS);
        lastFrameTimeRef.current = timestamp;

        const prev = gameRef.current;
        if (prev.phase !== "GameOver") {
          const next = tick(prev, dtMs, {
            playerX: inputRef.current.playerX,
            fire: inputRef.current.fire,
          });
          gameRef.current = next;
          if (next.score !== prevScoreRef.current) {
            prevScoreRef.current = next.score;
            onScoreChangeRef.current?.(next.score);
          }
          if (next.phase === "GameOver") {
            onGameOverRef.current?.(next.score);
          }
        }
        // Starfield scrolls continuously
        sfRef.current = tickStarfield(sfRef.current, dtMs);

        setRenderState({ game: gameRef.current, sf: sfRef.current });
        id = requestAnimationFrame(loop);
      }

      id = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(id);
    }, []); // intentionally empty — loop lives for component lifetime

    const { game: state, sf } = renderState;
    const { player } = state;
    const displayW = Math.round(width * scale);
    const displayH = Math.round(height * scale);
    const hs = Math.max(highScore, state.score);

    const blink =
      player.invincibleTimer > 0 &&
      Math.floor(player.invincibleTimer / INVINCIBLE_BLINK_INTERVAL) % 2 === 1;

    return (
      <View style={{ width: displayW, height: displayH }}>
        <Canvas
          style={[styles.canvas, { width: displayW, height: displayH }]}
          accessibilityLabel={t("game.canvasLabel")}
          accessibilityRole="none"
        >
          <Group transform={[{ scale }]}>
            <Fill color="#000010" />

            {/* Starfield */}
            {sf.stars.map((star, i) => (
              <Circle
                key={i}
                cx={star.x}
                cy={star.y}
                r={star.r}
                color={`rgba(255,255,255,${star.opacity})`}
              />
            ))}

            {/* Enemy bullets */}
            {state.enemyBullets.map((b) => (
              <Rect
                key={b.id}
                x={b.x - b.width / 2}
                y={b.y - b.height / 2}
                width={b.width}
                height={b.height}
                color="#ff4422"
              />
            ))}

            {/* Player bullets */}
            {state.playerBullets.map((b) =>
              images.bulletPlayer ? (
                <SkiaImage
                  key={b.id}
                  image={images.bulletPlayer}
                  x={b.x - b.width / 2}
                  y={b.y - b.height / 2}
                  width={b.width}
                  height={b.height}
                  fit="fill"
                />
              ) : (
                <Rect
                  key={b.id}
                  x={b.x - b.width / 2}
                  y={b.y - b.height / 2}
                  width={b.width}
                  height={b.height}
                  color="#00ffcc"
                />
              )
            )}

            {/* Enemies */}
            {state.enemies.map((enemy) => {
              if (!enemy.isAlive) return null;
              const img =
                enemy.tier === "Grunt"
                  ? images.enemyGrunt
                  : enemy.tier === "Elite"
                    ? images.enemyElite
                    : images.enemyBoss;
              const fallbackColor =
                enemy.tier === "Grunt"
                  ? "#8888ff"
                  : enemy.tier === "Elite"
                    ? "#ff88ff"
                    : "#ffff44";
              return img ? (
                <SkiaImage
                  key={enemy.id}
                  image={img}
                  x={enemy.x - enemy.width / 2}
                  y={enemy.y - enemy.height / 2}
                  width={enemy.width}
                  height={enemy.height}
                  fit="fill"
                />
              ) : (
                <Rect
                  key={enemy.id}
                  x={enemy.x - enemy.width / 2}
                  y={enemy.y - enemy.height / 2}
                  width={enemy.width}
                  height={enemy.height}
                  color={fallbackColor}
                />
              );
            })}

            {/* Player */}
            {!blink &&
              (images.playerShip ? (
                <SkiaImage
                  image={images.playerShip}
                  x={player.x - player.width / 2}
                  y={player.y - player.height / 2}
                  width={player.width}
                  height={player.height}
                  fit="fill"
                />
              ) : (
                <Rect
                  x={player.x - player.width / 2}
                  y={player.y - player.height / 2}
                  width={player.width}
                  height={player.height}
                  color="#00ffcc"
                />
              ))}

            {/* Explosions */}
            {state.explosions.map((exp) => {
              const frameImg = images.explosionFrames[exp.frame] ?? null;
              const half = EXPLOSION_DRAW_SIZE / 2;
              if (frameImg) {
                return (
                  <SkiaImage
                    key={exp.id}
                    image={frameImg}
                    x={exp.x - half}
                    y={exp.y - half}
                    width={EXPLOSION_DRAW_SIZE}
                    height={EXPLOSION_DRAW_SIZE}
                    fit="fill"
                  />
                );
              }
              const progress = exp.frame / 20;
              return (
                <Circle
                  key={exp.id}
                  cx={exp.x}
                  cy={exp.y}
                  r={6 + progress * 18}
                  color={progress < 0.4 ? "#ffcc00" : "#ff4400"}
                  opacity={1 - progress}
                />
              );
            })}
          </Group>
        </Canvas>

        {/* HUD overlay — React Native Text over the Skia canvas */}
        <View style={styles.hud} pointerEvents="none">
          <View style={styles.hudTop}>
            <Text style={styles.hudText}>{`${t("hud.score")} ${state.score}`}</Text>
            <Text style={styles.hudText}>{`${t("hud.best")} ${hs}`}</Text>
            <Text style={styles.hudText}>{`${t("hud.wave")} ${state.wave}`}</Text>
          </View>

          <View style={styles.hudBottom}>
            {Array.from({ length: player.lives }, (_, i) => (
              <View key={i} style={styles.lifeIndicator} />
            ))}
          </View>

          {state.phase === "WaveClear" && (
            <View style={styles.phaseOverlay}>
              <Text style={styles.overlayTitle}>{t("phase.waveClear")}</Text>
            </View>
          )}

          {state.phase === "ChallengingStage" && (
            <View style={styles.phaseOverlay}>
              <Text style={[styles.overlayTitle, styles.challengingTitle]}>
                {t("phase.challengingStage")}
              </Text>
              <Text style={styles.overlaySubtitle}>
                {t("phase.hits", { count: state.challengingHits })}
              </Text>
            </View>
          )}

          {state.phase === "GameOver" && (
            <View style={[styles.phaseOverlay, styles.gameOverOverlay]}>
              <Text style={styles.gameOverTitle}>{t("phase.gameOver")}</Text>
              <Text style={styles.gameOverScore}>{`${t("hud.score")} ${state.score}`}</Text>
            </View>
          )}
        </View>
      </View>
    );
  }
);

GameCanvas.displayName = "GameCanvas";
export default GameCanvas;

const styles = StyleSheet.create({
  canvas: {
    position: "absolute",
    top: 0,
    left: 0,
  },
  hud: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 8,
  },
  hudTop: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  hudText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "bold",
    fontVariant: ["tabular-nums"],
  },
  hudBottom: {
    position: "absolute",
    bottom: 8,
    left: 10,
    flexDirection: "row",
    gap: 6,
  },
  lifeIndicator: {
    width: 10,
    height: 14,
    backgroundColor: "#00ffcc",
  },
  phaseOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  overlayTitle: {
    color: "#00ffcc",
    fontSize: 22,
    fontWeight: "bold",
    textAlign: "center",
  },
  challengingTitle: {
    color: "#ffdd00",
  },
  overlaySubtitle: {
    color: "#ffffff",
    fontSize: 14,
    textAlign: "center",
    marginTop: 8,
  },
  gameOverOverlay: {
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  gameOverTitle: {
    color: "#ff4422",
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
  },
  gameOverScore: {
    color: "#ffffff",
    fontSize: 18,
    textAlign: "center",
    marginTop: 16,
    fontVariant: ["tabular-nums"],
  },
});
