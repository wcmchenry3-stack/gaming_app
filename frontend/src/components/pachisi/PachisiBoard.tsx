import React, { useMemo } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useTheme } from "../../theme/ThemeContext";
import { PlayerStateResponse } from "../../game/pachisi/api";
import {
  CELL_ROLES,
  TRACK_INDEX_TO_CELL,
  HOME_BASE_CELLS,
  PLAYER_COLORS,
  PLAYER_HOME_BG,
  CellRole,
} from "./boardLayout";

const BOARD_SIZE = 15;

interface PieceToken {
  player: string;
  pieceIndex: number;
  isValidMove: boolean;
}

interface Props {
  playerStates: PlayerStateResponse[];
  validMoves: number[];
  currentPlayer: string;
  humanPlayer: string;
  phase: string;
  onPiecePress: (pieceIndex: number) => void;
}

function cellBg(role: CellRole, colors: ReturnType<typeof useTheme>["colors"]): string {
  switch (role) {
    case "home_base_red":
      return PLAYER_HOME_BG["red"] ?? colors.surface;
    case "home_base_yellow":
      return PLAYER_HOME_BG["yellow"] ?? colors.surface;
    case "home_base_unused":
      return colors.surface;
    case "home_col_red":
      return "#ef9a9a";
    case "home_col_yellow":
      return "#fff176";
    case "safe":
      return "#c8e6c9"; // light green star
    case "center":
      return "#e8eaf6";
    case "track":
      return colors.surface;
    default:
      return colors.background;
  }
}

export default function PachisiBoard({
  playerStates,
  validMoves,
  currentPlayer,
  humanPlayer,
  phase,
  onPiecePress,
}: Props) {
  const { colors } = useTheme();

  // Build a map from "row,col" → list of PieceTokens
  const pieceMap = useMemo(() => {
    const map: Record<string, PieceToken[]> = {};

    for (const ps of playerStates) {
      const isCurrentPlayer = ps.player_id === currentPlayer;
      const isHuman = ps.player_id === humanPlayer;
      const canMove = isCurrentPlayer && isHuman && phase === "move";

      for (const piece of ps.pieces) {
        let cell: [number, number] | undefined;

        if (piece.position === -1) {
          // In home base — use spawn slot
          const slots = HOME_BASE_CELLS[ps.player_id];
          cell = slots ? slots[piece.index] : undefined;
        } else {
          cell = TRACK_INDEX_TO_CELL[piece.position];
        }

        if (!cell) continue;
        const key = `${cell[0]},${cell[1]}`;
        if (!map[key]) map[key] = [];
        map[key].push({
          player: ps.player_id,
          pieceIndex: piece.index,
          isValidMove: canMove && validMoves.includes(piece.index),
        });
      }
    }
    return map;
  }, [playerStates, validMoves, currentPlayer, humanPlayer, phase]);

  return (
    <View style={styles.board}>
      {Array.from({ length: BOARD_SIZE }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: BOARD_SIZE }, (_, col) => {
            const role = CELL_ROLES[`${row},${col}`] ?? "empty";
            const tokens = pieceMap[`${row},${col}`] ?? [];
            const bg = cellBg(role, colors);

            return (
              <View
                key={col}
                style={[styles.cell, { backgroundColor: bg, borderColor: colors.border }]}
              >
                {tokens.map((token) => {
                  const dotColor = PLAYER_COLORS[token.player] ?? "#888";
                  if (token.isValidMove) {
                    return (
                      <Pressable
                        key={`${token.player}-${token.pieceIndex}`}
                        style={[
                          styles.piece,
                          {
                            backgroundColor: dotColor,
                            borderColor: "#ffd700",
                            borderWidth: 2,
                          },
                        ]}
                        onPress={() => onPiecePress(token.pieceIndex)}
                        accessibilityRole="button"
                        accessibilityLabel={`${token.player} piece ${token.pieceIndex + 1}`}
                      />
                    );
                  }
                  return (
                    <View
                      key={`${token.player}-${token.pieceIndex}`}
                      style={[styles.piece, { backgroundColor: dotColor }]}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    aspectRatio: 1,
    width: "100%",
    maxWidth: 400,
  },
  row: {
    flex: 1,
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    borderWidth: 0.5,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 1,
  },
  piece: {
    width: "40%",
    aspectRatio: 1,
    borderRadius: 999,
    margin: 1,
  },
});
