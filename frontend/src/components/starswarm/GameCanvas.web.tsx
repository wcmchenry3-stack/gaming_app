import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";
import { View } from "react-native";
import { Asset } from "expo-asset";
import { useTranslation } from "react-i18next";
import { initStarSwarm, tick } from "../../game/starswarm/engine";
import { initStarfield, tickStarfield } from "../../game/starswarm/starfield";
import type { StarfieldState } from "../../game/starswarm/starfield";
import type { StarSwarmState } from "../../game/starswarm/types";

import playerShipSrc from "../../../assets/starswarm/player-ship.webp";
import enemyGruntSrc from "../../../assets/starswarm/enemy-grunt.webp";
import enemyEliteSrc from "../../../assets/starswarm/enemy-elite.webp";
import enemyBossSrc from "../../../assets/starswarm/enemy-boss.webp";
import bulletPlayerSrc from "../../../assets/starswarm/bullet-player.webp";
import bulletEnemySrc from "../../../assets/starswarm/bullet-enemy.webp";
import ef00 from "../../../assets/starswarm/explosion/frame00.png";
import ef01 from "../../../assets/starswarm/explosion/frame01.png";
import ef02 from "../../../assets/starswarm/explosion/frame02.png";
import ef03 from "../../../assets/starswarm/explosion/frame03.png";
import ef04 from "../../../assets/starswarm/explosion/frame04.png";
import ef05 from "../../../assets/starswarm/explosion/frame05.png";
import ef06 from "../../../assets/starswarm/explosion/frame06.png";
import ef07 from "../../../assets/starswarm/explosion/frame07.png";
import ef08 from "../../../assets/starswarm/explosion/frame08.png";
import ef09 from "../../../assets/starswarm/explosion/frame09.png";
import ef10 from "../../../assets/starswarm/explosion/frame10.png";
import ef11 from "../../../assets/starswarm/explosion/frame11.png";
import ef12 from "../../../assets/starswarm/explosion/frame12.png";
import ef13 from "../../../assets/starswarm/explosion/frame13.png";
import ef14 from "../../../assets/starswarm/explosion/frame14.png";
import ef15 from "../../../assets/starswarm/explosion/frame15.png";
import ef16 from "../../../assets/starswarm/explosion/frame16.png";
import ef17 from "../../../assets/starswarm/explosion/frame17.png";
import ef18 from "../../../assets/starswarm/explosion/frame18.png";
import ef19 from "../../../assets/starswarm/explosion/frame19.png";

const EXPLOSION_SRCS = [
  ef00,
  ef01,
  ef02,
  ef03,
  ef04,
  ef05,
  ef06,
  ef07,
  ef08,
  ef09,
  ef10,
  ef11,
  ef12,
  ef13,
  ef14,
  ef15,
  ef16,
  ef17,
  ef18,
  ef19,
] as const;

const EXPLOSION_DRAW_SIZE = 48;
const DT_CAP_MS = 33;
const INVINCIBLE_BLINK_INTERVAL = 120; // ms

interface Images {
  playerShip: HTMLImageElement | null;
  enemyGrunt: HTMLImageElement | null;
  enemyElite: HTMLImageElement | null;
  enemyBoss: HTMLImageElement | null;
  bulletPlayer: HTMLImageElement | null;
  bulletEnemy: HTMLImageElement | null;
  explosionFrames: (HTMLImageElement | null)[];
}

export interface GameCanvasHandle {
  reset: () => void;
  setPlayerX: (x: number) => void;
  setFire: (fire: boolean) => void;
  setChargeShot: (fire: boolean) => void;
}

interface Props {
  highScore?: number;
  onGameOver?: (finalScore: number) => void;
  onScoreChange?: (score: number) => void;
  onPlayerHit?: () => void;
  onWaveClear?: () => void;
  isPaused?: boolean;
  width: number;
  height: number;
  scale: number;
}

const GameCanvas = forwardRef<GameCanvasHandle, Props>(
  (
    {
      highScore = 0,
      onGameOver,
      onScoreChange,
      onPlayerHit,
      onWaveClear,
      isPaused = false,
      width,
      height,
      scale,
    },
    ref
  ) => {
    const { t } = useTranslation("starswarm");
    const tRef = useRef(t);
    useEffect(() => {
      tRef.current = t;
    }, [t]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const scaleRef = useRef(scale);
    const stateRef = useRef<StarSwarmState>(initStarSwarm(width, height));
    const sfRef = useRef<StarfieldState>(initStarfield(width, height));
    const inputRef = useRef({ playerX: width / 2, fire: true, chargeShot: false });
    const lastFrameTimeRef = useRef(0);
    const highScoreRef = useRef(highScore);
    const onGameOverRef = useRef(onGameOver);
    const onScoreChangeRef = useRef(onScoreChange);
    const onPlayerHitRef = useRef(onPlayerHit);
    const onWaveClearRef = useRef(onWaveClear);
    const isPausedRef = useRef(isPaused);
    const prevScoreRef = useRef(0);
    const prevLivesRef = useRef(stateRef.current.player.lives);
    const prevPhaseRef = useRef(stateRef.current.phase);
    const imagesRef = useRef<Images>({
      playerShip: null,
      enemyGrunt: null,
      enemyElite: null,
      enemyBoss: null,
      bulletPlayer: null,
      bulletEnemy: null,
      explosionFrames: Array(20).fill(null) as null[],
    });

    useEffect(() => {
      scaleRef.current = scale;
    }, [scale]);
    useEffect(() => {
      highScoreRef.current = highScore;
    }, [highScore]);
    useEffect(() => {
      onGameOverRef.current = onGameOver;
    }, [onGameOver]);
    useEffect(() => {
      onScoreChangeRef.current = onScoreChange;
    }, [onScoreChange]);
    useEffect(() => {
      onPlayerHitRef.current = onPlayerHit;
    }, [onPlayerHit]);
    useEffect(() => {
      onWaveClearRef.current = onWaveClear;
    }, [onWaveClear]);
    useEffect(() => {
      const wasPaused = isPausedRef.current;
      isPausedRef.current = isPaused;
      if (wasPaused && !isPaused) lastFrameTimeRef.current = 0;
    }, [isPaused]);

    useEffect(() => {
      let cancelled = false;

      async function loadImg(src: number): Promise<HTMLImageElement | null> {
        try {
          const asset = Asset.fromModule(src);
          await asset.downloadAsync();
          const uri = asset.localUri ?? asset.uri;
          if (!uri) return null;
          return new Promise((resolve) => {
            const img = new window.Image();
            img.crossOrigin = "anonymous";
            img.src = uri;
            img.onload = () => resolve(img);
            img.onerror = () => resolve(null);
          });
        } catch {
          return null;
        }
      }

      (async () => {
        const results = await Promise.all([
          loadImg(playerShipSrc as number),
          loadImg(enemyGruntSrc as number),
          loadImg(enemyEliteSrc as number),
          loadImg(enemyBossSrc as number),
          loadImg(bulletPlayerSrc as number),
          loadImg(bulletEnemySrc as number),
          ...EXPLOSION_SRCS.map((s) => loadImg(s as number)),
        ]);
        if (cancelled) return;
        const [
          playerShip,
          enemyGrunt,
          enemyElite,
          enemyBoss,
          bulletPlayer,
          bulletEnemy,
          ...frames
        ] = results;
        imagesRef.current = {
          playerShip: playerShip ?? null,
          enemyGrunt: enemyGrunt ?? null,
          enemyElite: enemyElite ?? null,
          enemyBoss: enemyBoss ?? null,
          bulletPlayer: bulletPlayer ?? null,
          bulletEnemy: bulletEnemy ?? null,
          explosionFrames: frames.map((f) => f ?? null),
        };
      })();

      return () => {
        cancelled = true;
      };
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        reset() {
          stateRef.current = initStarSwarm(width, height);
          sfRef.current = initStarfield(width, height);
          inputRef.current.playerX = width / 2;
          inputRef.current.chargeShot = false;
          prevScoreRef.current = 0;
          prevLivesRef.current = stateRef.current.player.lives;
          prevPhaseRef.current = stateRef.current.phase;
        },
        setPlayerX(x) {
          inputRef.current.playerX = x;
        },
        setFire(fire) {
          inputRef.current.fire = fire;
        },
        setChargeShot(fire) {
          inputRef.current.chargeShot = fire;
        },
      }),
      [width, height]
    );

    const draw = useCallback(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const s = scaleRef.current;
      const state = stateRef.current;
      const sf = sfRef.current;
      const imgs = imagesRef.current;
      const t = tRef.current;
      const hs = Math.max(highScoreRef.current, state.score);
      const { player } = state;

      const displayW = width * s;
      const displayH = height * s;
      ctx.clearRect(0, 0, displayW, displayH);
      ctx.save();
      ctx.scale(s, s);

      // Background
      ctx.fillStyle = "#000010";
      ctx.fillRect(0, 0, width, height);

      // Starfield
      for (const star of sf.stars) {
        ctx.globalAlpha = star.opacity;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Enemy bullets
      ctx.fillStyle = "#ff4422";
      for (const b of state.enemyBullets) {
        ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
      }

      // Player bullets
      for (const b of state.playerBullets) {
        const img = imgs.bulletPlayer;
        if (img) {
          ctx.drawImage(img, b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
        } else {
          ctx.fillStyle = "#00ffcc";
          ctx.fillRect(b.x - b.width / 2, b.y - b.height / 2, b.width, b.height);
        }
      }

      // Enemies
      for (const enemy of state.enemies) {
        if (!enemy.isAlive) continue;
        const img =
          enemy.tier === "Grunt"
            ? imgs.enemyGrunt
            : enemy.tier === "Elite"
              ? imgs.enemyElite
              : imgs.enemyBoss;
        if (img) {
          ctx.drawImage(
            img,
            enemy.x - enemy.width / 2,
            enemy.y - enemy.height / 2,
            enemy.width,
            enemy.height
          );
        } else {
          ctx.fillStyle =
            enemy.tier === "Grunt" ? "#8888ff" : enemy.tier === "Elite" ? "#ff88ff" : "#ffff44";
          ctx.fillRect(
            enemy.x - enemy.width / 2,
            enemy.y - enemy.height / 2,
            enemy.width,
            enemy.height
          );
        }
      }

      // Player (blink during invincibility)
      const blink =
        player.invincibleTimer > 0 &&
        Math.floor(player.invincibleTimer / INVINCIBLE_BLINK_INTERVAL) % 2 === 1;
      if (!blink) {
        const img = imgs.playerShip;
        if (img) {
          ctx.drawImage(
            img,
            player.x - player.width / 2,
            player.y - player.height / 2,
            player.width,
            player.height
          );
        } else {
          ctx.fillStyle = "#00ffcc";
          ctx.beginPath();
          ctx.moveTo(player.x, player.y - player.height / 2);
          ctx.lineTo(player.x - player.width / 2, player.y + player.height / 2);
          ctx.lineTo(player.x + player.width / 2, player.y + player.height / 2);
          ctx.closePath();
          ctx.fill();
        }
      }

      // Explosions
      for (const exp of state.explosions) {
        const frameImg = imgs.explosionFrames[exp.frame] ?? null;
        const half = EXPLOSION_DRAW_SIZE / 2;
        if (frameImg) {
          ctx.drawImage(
            frameImg,
            exp.x - half,
            exp.y - half,
            EXPLOSION_DRAW_SIZE,
            EXPLOSION_DRAW_SIZE
          );
        } else {
          const progress = exp.frame / 20;
          ctx.globalAlpha = 1 - progress;
          ctx.fillStyle = progress < 0.4 ? "#ffcc00" : "#ff4400";
          ctx.beginPath();
          ctx.arc(exp.x, exp.y, 6 + progress * 18, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }

      // HUD
      ctx.font = "bold 13px 'Courier New', monospace";
      ctx.textBaseline = "top";
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.fillText(`${t("hud.score")} ${state.score}`, 10, 8);
      ctx.textAlign = "center";
      ctx.fillText(`${t("hud.best")} ${hs}`, width / 2, 8);
      ctx.textAlign = "right";
      ctx.fillText(`${t("hud.wave")} ${state.wave}`, width - 10, 8);

      // Lives — small cyan rectangles at bottom-left
      for (let i = 0; i < player.lives; i++) {
        ctx.fillStyle = "#00ffcc";
        ctx.fillRect(10 + i * 16, height - 18, 10, 14);
      }

      // Phase overlays
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      if (state.phase === "WaveClear") {
        ctx.font = "bold 22px 'Courier New', monospace";
        ctx.fillStyle = "#00ffcc";
        ctx.fillText(t("phase.waveClear"), width / 2, height / 2);
      }

      if (state.phase === "ChallengingStage") {
        ctx.font = "bold 20px 'Courier New', monospace";
        ctx.fillStyle = "#ffdd00";
        ctx.fillText(t("phase.challengingStage"), width / 2, height / 2 - 18);
        ctx.font = "14px 'Courier New', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(t("phase.hits", { count: state.challengingHits }), width / 2, height / 2 + 12);
      }

      if (state.phase === "GameOver") {
        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(0, 0, width, height);
        ctx.font = "bold 28px 'Courier New', monospace";
        ctx.fillStyle = "#ff4422";
        ctx.fillText(t("phase.gameOver"), width / 2, height / 2 - 22);
        ctx.font = "16px 'Courier New', monospace";
        ctx.fillStyle = "#ffffff";
        ctx.fillText(`${t("hud.score")} ${state.score}`, width / 2, height / 2 + 18);
      }

      ctx.restore();
    }, [width, height]);

    const drawRef = useRef(draw);
    useEffect(() => {
      drawRef.current = draw;
    }, [draw]);

    // Single long-lived RAF loop — reads all mutable game state from refs
    useEffect(() => {
      let id: number;

      function loop(timestamp: number) {
        if (lastFrameTimeRef.current === 0) lastFrameTimeRef.current = timestamp;
        const dtMs = Math.min(timestamp - lastFrameTimeRef.current, DT_CAP_MS);
        lastFrameTimeRef.current = timestamp;

        const prev = stateRef.current;
        if (prev.phase !== "GameOver" && !isPausedRef.current) {
          const next = tick(prev, dtMs, {
            playerX: inputRef.current.playerX,
            fire: inputRef.current.fire,
            chargeShot: inputRef.current.chargeShot,
          });
          if (inputRef.current.chargeShot) inputRef.current.chargeShot = false;
          stateRef.current = next;
          if (next.score !== prevScoreRef.current) {
            prevScoreRef.current = next.score;
            onScoreChangeRef.current?.(next.score);
          }
          if (next.player.lives < prevLivesRef.current) {
            if (next.phase !== "GameOver") onPlayerHitRef.current?.();
          }
          prevLivesRef.current = next.player.lives;
          if (next.phase === "WaveClear" && prevPhaseRef.current !== "WaveClear") {
            onWaveClearRef.current?.();
          }
          prevPhaseRef.current = next.phase;
          if (next.phase === "GameOver") {
            onGameOverRef.current?.(next.score);
          }
        }
        // Starfield scrolls continuously, even on game over
        sfRef.current = tickStarfield(sfRef.current, dtMs);

        drawRef.current();
        id = requestAnimationFrame(loop);
      }

      function handleVisibilityChange() {
        if (!document.hidden) lastFrameTimeRef.current = 0;
      }
      document.addEventListener("visibilitychange", handleVisibilityChange);
      id = requestAnimationFrame(loop);
      return () => {
        cancelAnimationFrame(id);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      };
    }, []); // intentionally empty — loop lives for component lifetime

    const displayW = Math.round(width * scale);
    const displayH = Math.round(height * scale);

    return (
      <View
        style={{ width: displayW, height: displayH }}
        accessibilityLabel={t("game.canvasLabel")}
        accessibilityRole="image"
      >
        <canvas ref={canvasRef} width={displayW} height={displayH} style={{ display: "block" }} />
      </View>
    );
  }
);

GameCanvas.displayName = "GameCanvas";
export default GameCanvas;
