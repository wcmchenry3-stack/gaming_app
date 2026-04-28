/**
 * Mahjong Solitaire — native canvas (iOS / Android).
 *
 * Rendered via @shopify/react-native-skia.
 * Metro automatically uses GameCanvas.web.tsx on the web platform.
 *
 * Tile geometry (grid → pixels):
 *   pixel_x = PAD_X + (col / 2) * TILE_W + layer * LAYER_DX
 *   pixel_y = PAD_Y + row * TILE_H − layer * LAYER_DY
 *
 * Rendering order: layer ASC so higher layers appear on top.
 * Hit-testing: topmost tile (highest layer) at touch point wins.
 */

import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Canvas, Fill, Group, ImageSVG, Rect, useSVG } from "@shopify/react-native-skia";
import { useTranslation } from "react-i18next";
import { hasFreePairs, isFreeTile } from "../../game/mahjong/engine";
import type { MahjongState, SlotTile } from "../../game/mahjong/types";
import { TILE_REQUIRES } from "./tileAssets";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const TILE_W = 44; // face width
const TILE_H = 56; // face height
const SIDE_W = 5; // 3-D side strip width (right + bottom)
const LAYER_DX = 6; // rightward offset per layer
const LAYER_DY = 5; // upward offset per layer
const PAD_X = 10;
const PAD_Y = 30; // extra top padding so layer-4 tiles don't clip

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
const TILE_FACE_LOCKED = "#d0c8b8";
const BORDER_NORMAL = "#8b7355";
const BORDER_SELECTED = "#ffd700";
const BORDER_HINT = "#5dbcd2";
const SIDE_R = "#a89070";
const SIDE_B = "#987860";
const SHADOW = "rgba(0,0,0,0.35)";

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
// SVG face art
// ---------------------------------------------------------------------------

function TileFaceLayer({
  faceId,
  suit,
  x,
  y,
  w,
  h,
  opacity,
}: {
  faceId: number;
  suit: string;
  x: number;
  y: number;
  w: number;
  h: number;
  opacity: number;
}) {
  const svg = useSVG(TILE_REQUIRES[faceId - 1]);
  if (!svg) {
    // SVG not yet loaded or failed to parse — render a suit-color placeholder
    // so the tile face is never silently blank.
    const fallbackColor = SUIT_COLOR[suit] ?? "#888888";
    return (
      <Rect
        x={x + 6}
        y={y + 8}
        width={w - 12}
        height={h - 16}
        color={fallbackColor}
        opacity={opacity}
      />
    );
  }
  return <ImageSVG svg={svg} x={x} y={y} width={w} height={h} opacity={opacity} />;
}

// ---------------------------------------------------------------------------
// Hit-testing
// ---------------------------------------------------------------------------

function hitTest(tiles: readonly SlotTile[], tapX: number, tapY: number): number | null {
  const fw = TILE_W - SIDE_W;
  const fh = TILE_H - SIDE_W;
  // Iterate from highest layer down so the topmost tile wins.
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

  const [showDeadlockOverlay, setShowDeadlockOverlay] = useState(false);
  useEffect(() => {
    if (!state.isDeadlocked) {
      setShowDeadlockOverlay(false);
      return;
    }
    const timer = setTimeout(() => setShowDeadlockOverlay(true), 500);
    return () => clearTimeout(timer);
  }, [state.isDeadlocked]);

  const sortedTiles = useMemo(
    () => [...state.tiles].sort((a, b) => a.layer - b.layer || a.row - b.row),
    [state.tiles]
  );

  const selectedId = state.selected?.id ?? null;
  const hasSelection = selectedId !== null;
  const gameActive = !state.isComplete && !state.isDeadlocked && !showShuffleCTA;

  function handleTap(e: { nativeEvent: { locationX: number; locationY: number } }) {
    if (!gameActive) return;
    const { locationX, locationY } = e.nativeEvent;
    const tileId = hitTest(state.tiles, locationX, locationY);
    if (tileId !== null) onTilePress(tileId);
  }

  return (
    <View style={{ width: BOARD_W, height: BOARD_H }}>
      <Canvas
        style={{ width: BOARD_W, height: BOARD_H }}
        accessibilityLabel={t("game.canvasLabel")}
        accessibilityRole="none"
      >
        <Fill color={BG} />
        {sortedTiles.map((tile) => {
          const x = tileX(tile.col, tile.layer);
          const y = tileY(tile.row, tile.layer);
          const isSelected = tile.id === selectedId;
          const isFree = freeTiles.has(tile.id);
          const borderColor = isSelected
            ? BORDER_SELECTED
            : isFree && hasSelection
              ? BORDER_HINT
              : BORDER_NORMAL;
          const faceColor = isFree ? TILE_FACE : TILE_FACE_LOCKED;
          const fw = TILE_W - SIDE_W;
          const fh = TILE_H - SIDE_W;

          return (
            <Group key={tile.id}>
              {/* Drop shadow */}
              <Rect x={x + SIDE_W + 2} y={y + SIDE_W + 2} width={fw} height={fh} color={SHADOW} />
              {/* Right 3-D side */}
              <Rect x={x + fw} y={y + SIDE_W} width={SIDE_W} height={fh} color={SIDE_R} />
              {/* Bottom 3-D side */}
              <Rect x={x + SIDE_W} y={y + fh} width={fw} height={SIDE_W} color={SIDE_B} />
              {/* Border */}
              <Rect x={x} y={y} width={fw} height={fh} color={borderColor} />
              {/* Face */}
              <Rect x={x + 1} y={y + 1} width={fw - 2} height={fh - 2} color={faceColor} />
              {/* SVG face art */}
              <TileFaceLayer
                faceId={tile.faceId}
                suit={tile.suit}
                x={x + 2}
                y={y + 2}
                w={fw - 4}
                h={fh - 4}
                opacity={isFree ? 1 : 0.35}
              />
            </Group>
          );
        })}
      </Canvas>

      {/* Touch capture layer — disabled during overlays */}
      {gameActive && (
        <Pressable style={StyleSheet.absoluteFill} onPress={handleTap} accessibilityRole="none" />
      )}

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
