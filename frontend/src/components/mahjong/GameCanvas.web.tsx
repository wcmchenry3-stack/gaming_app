/**
 * Mahjong Solitaire — web canvas (Expo Web / browser).
 *
 * Rendered via HTML Canvas 2D.
 * Metro uses this file automatically on the web platform.
 *
 * Tile geometry (grid → pixels):
 *   pixel_x = PAD_X + (col / 2) * TILE_W + layer * LAYER_DX
 *   pixel_y = PAD_Y + row * TILE_H − layer * LAYER_DY
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Asset } from "expo-asset";
import { useTranslation } from "react-i18next";
import { hasFreePairs, isFreeTile, tilesMatch } from "../../game/mahjong/engine";
import type { MahjongState, SlotTile } from "../../game/mahjong/types";
import { TILE_REQUIRES } from "./tileAssets";
import {
  MAHJONG_TILE_FACE_SELECTED,
  MAHJONG_GLOW_BG,
  MAHJONG_GLOW_SHADOW,
} from "../../theme/theme.constants";

// ---------------------------------------------------------------------------
// Layout constants (mirror GameCanvas.tsx exactly)
// ---------------------------------------------------------------------------

export const TILE_W = 44;
export const TILE_H = 56;
const SIDE_W = 5;
const LAYER_DX = 6;
const LAYER_DY = 5;
const PAD_X = 10;
const PAD_Y = 30;

export const BOARD_W = PAD_X + 12 * TILE_W + 4 * LAYER_DX + PAD_X; // 572
export const BOARD_H = PAD_Y + 8 * TILE_H + 4 * LAYER_DY + PAD_Y; // 508

function tileX(col: number, layer: number): number {
  return PAD_X + (col / 2) * TILE_W + layer * LAYER_DX;
}
function tileY(row: number, layer: number): number {
  return PAD_Y + row * TILE_H - layer * LAYER_DY;
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------

const BG = "#1a3a1a";
const TILE_FACE = "#f5f0e8";
const TILE_FACE_SELECTED = MAHJONG_TILE_FACE_SELECTED;
const TILE_FACE_LOCKED = "#d0c8b8";
const BORDER_NORMAL = "#8b7355";
const BORDER_SELECTED = "#ffd700";
const BORDER_HINT = "#5dbcd2";
const SIDE_R = "#a89070";
const SIDE_B = "#987860";

const SUIT_COLOR: Record<string, string> = {
  characters: "#cc0000",
  circles: "#006633",
  bamboos: "#003322",
  winds: "#334455",
  dragons: "#880011",
  flowers: "#aa2299",
  seasons: "#0044aa",
};

// ---------------------------------------------------------------------------
// Hit-testing
// ---------------------------------------------------------------------------

function hitTest(tiles: readonly SlotTile[], tapX: number, tapY: number): number | null {
  const fw = TILE_W - SIDE_W;
  const fh = TILE_H - SIDE_W;
  const sorted = [...tiles].sort((a, b) => b.layer - a.layer);
  for (const tile of sorted) {
    const x = tileX(tile.col, tile.layer);
    const y = tileY(tile.row, tile.layer);
    if (tapX >= x && tapX < x + fw && tapY >= y && tapY < y + fh) {
      return tile.id;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Canvas 2D drawing
// ---------------------------------------------------------------------------

function drawBoard(
  ctx: CanvasRenderingContext2D,
  state: MahjongState,
  freeTiles: ReadonlySet<number>,
  tileImages: readonly (HTMLImageElement | null)[]
): void {
  ctx.clearRect(0, 0, BOARD_W, BOARD_H);

  // Background
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, BOARD_W, BOARD_H);

  const selectedId = state.selected?.id ?? null;
  const hasSelection = selectedId !== null;

  // Draw tiles lowest layer → highest so higher layers appear on top.
  const sorted = [...state.tiles].sort((a, b) => a.layer - b.layer || a.row - b.row);

  for (const tile of sorted) {
    ctx.save();

    const x = tileX(tile.col, tile.layer);
    const y = tileY(tile.row, tile.layer);
    const isSelected = tile.id === selectedId;
    const isFree = freeTiles.has(tile.id);
    const fw = TILE_W - SIDE_W;
    const fh = TILE_H - SIDE_W;

    // Lift selected tile upward/outward for a "picked up" cue.
    const liftX = isSelected ? 4 : 0;
    const liftY = isSelected ? -5 : 0;
    // 2 px border on selected for visibility at small tile sizes.
    const borderInset = isSelected ? 2 : 1;

    // Hints only on tiles that actually match the selection, not all free tiles.
    const isHint =
      isFree && hasSelection && state.selected !== null && tilesMatch(tile, state.selected);
    const borderColor = isSelected ? BORDER_SELECTED : isHint ? BORDER_HINT : BORDER_NORMAL;
    const faceColor = isSelected ? TILE_FACE_SELECTED : isFree ? TILE_FACE : TILE_FACE_LOCKED;
    const suitColor = SUIT_COLOR[tile.suit] ?? "#888888";

    // Drop shadow
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(x + SIDE_W + 2 + liftX, y + SIDE_W + 2 + liftY, fw, fh);

    // Right 3-D side
    ctx.fillStyle = SIDE_R;
    ctx.fillRect(x + fw + liftX, y + SIDE_W + liftY, SIDE_W, fh);

    // Bottom 3-D side
    ctx.fillStyle = SIDE_B;
    ctx.fillRect(x + SIDE_W + liftX, y + fh + liftY, fw, SIDE_W);

    // Gold glow behind selected tile — applied to the border rect only.
    if (isSelected) {
      ctx.shadowColor = MAHJONG_GLOW_SHADOW;
      ctx.shadowBlur = 10;
    }

    // Border
    ctx.fillStyle = borderColor;
    ctx.fillRect(x + liftX, y + liftY, fw, fh);

    // Clear glow before drawing face so inner fills stay crisp.
    ctx.shadowBlur = 0;

    // Face
    ctx.fillStyle = faceColor;
    ctx.fillRect(
      x + borderInset + liftX,
      y + borderInset + liftY,
      fw - 2 * borderInset,
      fh - 2 * borderInset
    );

    // SVG face art — fall back to suit-color rect while image is loading.
    // SVGs with width="100%" have naturalWidth=0 even when loaded; check for
    // null instead (images[i] is only set in onload, so non-null means ready).
    const img = tileImages[tile.faceId - 1];
    ctx.globalAlpha = isFree ? 1 : 0.35;
    if (img !== null) {
      ctx.drawImage(img, x + 2 + liftX, y + 2 + liftY, fw - 4, fh - 4);
    } else {
      ctx.fillStyle = suitColor;
      ctx.fillRect(x + 8 + liftX, y + 10 + liftY, fw - 16, fh - 20);
    }

    ctx.restore();
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface Props {
  state: MahjongState;
  onTilePress: (tileId: number) => void;
  onShufflePress: () => void;
  onNewGamePress: () => void;
}

export default function GameCanvas({ state, onTilePress, onShufflePress, onNewGamePress }: Props) {
  const { t } = useTranslation("mahjong");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tileImagesRef = useRef<(HTMLImageElement | null)[]>(Array(42).fill(null));
  const [imagesVersion, setImagesVersion] = useState(0);

  const freeTiles = useMemo(() => {
    const s = new Set<number>();
    for (const tile of state.tiles) {
      if (isFreeTile(tile, state.tiles)) s.add(tile.id);
    }
    return s;
  }, [state.tiles]);

  const noFreePairs = useMemo(
    () => !state.isComplete && !hasFreePairs(state.tiles),
    [state.isComplete, state.tiles]
  );
  const showShuffleCTA = noFreePairs && state.shufflesLeft > 0;
  const gameActive = !state.isComplete && !state.isDeadlocked && !showShuffleCTA;

  const [showDeadlockOverlay, setShowDeadlockOverlay] = useState(false);
  useEffect(() => {
    if (!state.isDeadlocked) {
      setShowDeadlockOverlay(false);
      return;
    }
    const timer = setTimeout(() => setShowDeadlockOverlay(true), 500);
    return () => clearTimeout(timer);
  }, [state.isDeadlocked]);

  // Load all 42 SVG tile images once on mount.
  useEffect(() => {
    const images: (HTMLImageElement | null)[] = Array(42).fill(null);
    tileImagesRef.current = images;
    let cancelled = false;

    (async () => {
      await Promise.all(
        (TILE_REQUIRES as number[]).map(async (src, i) => {
          try {
            const asset = Asset.fromModule(src);
            await asset.downloadAsync();
            const uri = asset.localUri ?? asset.uri;
            if (!uri || cancelled) return;
            await new Promise<void>((resolve) => {
              const img = new window.Image();
              img.crossOrigin = "anonymous";
              img.src = uri;
              img.onload = () => {
                if (!cancelled) images[i] = img;
                resolve();
              };
              img.onerror = () => resolve();
            });
          } catch {
            // SVG failed to load — suit-color fallback stays
          }
        })
      );
      if (!cancelled && images.some((img) => img !== null)) setImagesVersion((v) => v + 1);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Redraw whenever state or tile images change.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawBoard(ctx, state, freeTiles, tileImagesRef.current);
  }, [state, freeTiles, imagesVersion]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!gameActive) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const tapY = e.clientY - rect.top;
      const tileId = hitTest(state.tiles, tapX, tapY);
      if (tileId !== null) onTilePress(tileId);
    },
    [state.tiles, onTilePress, gameActive]
  );

  return (
    <View style={{ width: BOARD_W, height: BOARD_H }}>
      <canvas
        ref={canvasRef}
        width={BOARD_W}
        height={BOARD_H}
        onClick={handleClick}
        style={{ display: "block", cursor: gameActive ? "pointer" : "default" }}
        aria-label={t("game.canvasLabel")}
        role="img"
      />

      {/* Shuffle CTA overlay */}
      {showShuffleCTA && (
        <View style={[styles.overlay, styles.noMovesOverlay]}>
          <Text style={styles.overlayTitle}>{t("overlay.noMoves")}</Text>
          <Text style={styles.overlayDetail}>{t("overlay.noMovesDetail")}</Text>
          <Pressable
            style={styles.btn}
            onPress={onShufflePress}
            accessibilityLabel={t("action.shuffleLabel")}
          >
            <Text style={styles.btnText}>
              {t("overlay.shuffleButton")} ({state.shufflesLeft})
            </Text>
          </Pressable>
        </View>
      )}

      {/* Deadlock overlay — shown after shake animation completes */}
      {showDeadlockOverlay && (
        <View style={[styles.overlay, styles.noMovesOverlay]}>
          <Text style={styles.overlayTitle}>{t("overlay.deadlocked")}</Text>
          <Text style={styles.overlayDetail}>{t("overlay.deadlockedDetail")}</Text>
          <Pressable
            style={styles.btn}
            onPress={onNewGamePress}
            accessibilityLabel={t("action.newGameLabel")}
          >
            <Text style={styles.btnText}>{t("overlay.newGameButton")}</Text>
          </Pressable>
        </View>
      )}

      {/* Win overlay */}
      {state.isComplete && (
        <View style={[styles.overlay, styles.winOverlay]}>
          <Text style={styles.winTitle}>{t("overlay.youWon")}</Text>
          <Text style={styles.overlayDetail}>
            {t("overlay.youWonDetail", { count: state.pairsRemoved })}
          </Text>
          <Text style={styles.winScore}>{t("score.display", { score: state.score })}</Text>
          <Pressable
            style={styles.btn}
            onPress={onNewGamePress}
            accessibilityLabel={t("action.newGameLabel")}
          >
            <Text style={styles.btnText}>{t("overlay.newGameButton")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  noMovesOverlay: {
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  winOverlay: {
    backgroundColor: "rgba(0,20,0,0.82)",
  },
  overlayTitle: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  overlayDetail: {
    color: "#cccccc",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 16,
  },
  winTitle: {
    color: "#ffd700",
    fontSize: 30,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 8,
  },
  winScore: {
    color: "#ffffff",
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
    fontVariant: ["tabular-nums"],
  },
  btn: {
    backgroundColor: "#2a7a2a",
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 6,
    marginTop: 4,
  },
  btnText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "bold",
    textAlign: "center",
  },
});
