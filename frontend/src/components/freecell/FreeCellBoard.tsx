import React, { useCallback, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { useTheme } from "../../theme/ThemeContext";

import { SUITS } from "../../game/freecell/types";
import { validateMove } from "../../game/freecell/engine";
import type { FreeCellState, Move } from "../../game/freecell/types";
import FreeCellSlot, { CARD_WIDTH } from "./FreeCellSlot";
import FoundationPile from "./FoundationPile";
import TableauColumn from "./TableauColumn";
import { DragProvider } from "../../game/_shared/drag/DragContext";
import { DragContainer } from "../../game/_shared/drag/DragContainer";
import type { DragSource, DragCard } from "../../game/_shared/drag/DragContext";

const TABLEAU_COLS = 8;
const COL_GAP = 2;
const ROW_GAP = 8;

const BOARD_WIDTH = TABLEAU_COLS * CARD_WIDTH + (TABLEAU_COLS - 1) * COL_GAP;

type Selection =
  | { kind: "tableau"; col: number; index: number }
  | { kind: "freecell"; cell: number }
  | null;

export interface FreeCellBoardProps {
  readonly state: FreeCellState;
  readonly onMove: (move: Move) => void;
}

export default function FreeCellBoard({ state, onMove }: FreeCellBoardProps) {
  const { t } = useTranslation("freecell");
  const { colors } = useTheme();
  const [selection, setSelection] = useState<Selection>(null);

  function tryMove(move: Move) {
    if (validateMove(state, move)) {
      onMove(move);
    }
    setSelection(null);
  }

  function handleTableauCardPress(col: number, index: number) {
    if (selection === null) {
      setSelection({ kind: "tableau", col, index });
      return;
    }
    if (selection.kind === "tableau" && selection.col === col && selection.index === index) {
      setSelection(null);
      return;
    }
    if (selection.kind === "tableau") {
      tryMove({
        type: "tableau-to-tableau",
        fromCol: selection.col,
        fromIndex: selection.index,
        toCol: col,
      });
    } else {
      tryMove({ type: "freecell-to-tableau", fromCell: selection.cell, toCol: col });
    }
  }

  function handleTableauEmptyPress(col: number) {
    if (selection === null) return;
    if (selection.kind === "tableau") {
      tryMove({
        type: "tableau-to-tableau",
        fromCol: selection.col,
        fromIndex: selection.index,
        toCol: col,
      });
    } else {
      tryMove({ type: "freecell-to-tableau", fromCell: selection.cell, toCol: col });
    }
  }

  function handleFreeCellPress(cell: number) {
    if (selection === null) {
      if (state.freeCells[cell] !== null) {
        setSelection({ kind: "freecell", cell });
      }
      return;
    }
    if (selection.kind === "freecell" && selection.cell === cell) {
      setSelection(null);
      return;
    }
    if (selection.kind === "tableau") {
      tryMove({ type: "tableau-to-freecell", fromCol: selection.col, toCell: cell });
    } else {
      setSelection(null);
    }
  }

  function handleFoundationPress() {
    if (selection === null) return;
    if (selection.kind === "tableau") {
      tryMove({ type: "tableau-to-foundation", fromCol: selection.col });
    } else {
      tryMove({ type: "freecell-to-foundation", fromCell: selection.cell });
    }
  }

  // ── Drag-and-drop handlers ──────────────────────────────────────────────────

  const handleDropToTableau = useCallback(
    (source: DragSource, toCol: number): boolean => {
      if (source.game !== "freecell") return false;
      if (source.type === "tableau") {
        if (
          !validateMove(state, {
            type: "tableau-to-tableau",
            fromCol: source.col,
            fromIndex: source.fromIndex,
            toCol,
          })
        )
          return false;
        onMove({
          type: "tableau-to-tableau",
          fromCol: source.col,
          fromIndex: source.fromIndex,
          toCol,
        });
        return true;
      }
      if (source.type === "freecell") {
        if (!validateMove(state, { type: "freecell-to-tableau", fromCell: source.cell, toCol }))
          return false;
        onMove({ type: "freecell-to-tableau", fromCell: source.cell, toCol });
        return true;
      }
      return false;
    },
    [state, onMove]
  );

  const handleDropToFoundation = useCallback(
    (source: DragSource): boolean => {
      if (source.game !== "freecell") return false;
      if (source.type === "tableau") {
        if (!validateMove(state, { type: "tableau-to-foundation", fromCol: source.col }))
          return false;
        onMove({ type: "tableau-to-foundation", fromCol: source.col });
        return true;
      }
      if (source.type === "freecell") {
        if (!validateMove(state, { type: "freecell-to-foundation", fromCell: source.cell }))
          return false;
        onMove({ type: "freecell-to-foundation", fromCell: source.cell });
        return true;
      }
      return false;
    },
    [state, onMove]
  );

  const handleDropToFreeCell = useCallback(
    (source: DragSource, toCell: number): boolean => {
      if (source.game !== "freecell" || source.type !== "tableau") return false;
      if (!validateMove(state, { type: "tableau-to-freecell", fromCol: source.col, toCell }))
        return false;
      onMove({ type: "tableau-to-freecell", fromCol: source.col, toCell });
      return true;
    },
    [state, onMove]
  );

  const getLegalDropIds = useCallback(
    (source: DragSource, cards: DragCard[]): string[] => {
      if (source.game !== "freecell") return [];
      const ids: string[] = [];

      // Tableau columns.
      for (let col = 0; col < TABLEAU_COLS; col++) {
        let move: Move | null = null;
        if (source.type === "tableau" && source.col !== col) {
          move = {
            type: "tableau-to-tableau",
            fromCol: source.col,
            fromIndex: source.fromIndex,
            toCol: col,
          };
        } else if (source.type === "freecell") {
          move = { type: "freecell-to-tableau", fromCell: source.cell, toCol: col };
        }
        if (move && validateMove(state, move)) ids.push(`freecell-tableau-${col}`);
      }

      // Free cell slots (single-card only).
      if (cards.length === 1 && source.type === "tableau") {
        for (let cell = 0; cell < 4; cell++) {
          if (
            validateMove(state, { type: "tableau-to-freecell", fromCol: source.col, toCell: cell })
          ) {
            ids.push(`freecell-slot-${cell}`);
          }
        }
      }

      // Foundation (single-card only).
      if (cards.length === 1) {
        let foundMove: Move | null = null;
        if (source.type === "tableau")
          foundMove = { type: "tableau-to-foundation", fromCol: source.col };
        else if (source.type === "freecell")
          foundMove = { type: "freecell-to-foundation", fromCell: source.cell };
        if (foundMove && validateMove(state, foundMove)) {
          for (const suit of SUITS) ids.push(`freecell-foundation-${suit}`);
        }
      }

      return ids;
    },
    [state]
  );

  return (
    <DragProvider getLegalDropIds={getLegalDropIds}>
      <DragContainer>
        <View
          style={styles.board}
          accessibilityRole="none"
          accessibilityLabel={t("a11y.boardRegion")}
        >
          <View
            style={[
              styles.topRow,
              {
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
                paddingTop: 6,
                paddingBottom: 8,
              },
            ]}
          >
            {state.freeCells.map((card, i) => (
              <FreeCellSlot
                key={i}
                card={card}
                cellIndex={i}
                selected={selection?.kind === "freecell" && selection.cell === i}
                hintSource={
                  (state.hint?.type === "freecell-to-tableau" && state.hint.fromCell === i) ||
                  (state.hint?.type === "freecell-to-foundation" && state.hint.fromCell === i)
                }
                onPress={handleFreeCellPress}
                dropId={`freecell-slot-${i}`}
                onDrop={(source) => handleDropToFreeCell(source, i)}
              />
            ))}
            {SUITS.map((suit) => (
              <FoundationPile
                key={suit}
                pile={state.foundations[suit]}
                suit={suit}
                selected={false}
                onPress={() => handleFoundationPress()}
                dropId={`freecell-foundation-${suit}`}
                onDrop={(source) => handleDropToFoundation(source)}
              />
            ))}
          </View>

          <View style={styles.tableau}>
            {state.tableau.map((pile, col) => (
              <TableauColumn
                key={col}
                pile={pile}
                colIndex={col}
                selectedIndex={
                  selection?.kind === "tableau" && selection.col === col
                    ? selection.index
                    : undefined
                }
                hintIndex={
                  (state.hint?.type === "tableau-to-tableau" ||
                    state.hint?.type === "tableau-to-freecell" ||
                    state.hint?.type === "tableau-to-foundation") &&
                  state.hint.fromCol === col
                    ? state.hint.type === "tableau-to-tableau"
                      ? state.hint.fromIndex
                      : pile.length - 1
                    : undefined
                }
                onCardPress={handleTableauCardPress}
                onEmptyPress={handleTableauEmptyPress}
                dropId={`freecell-tableau-${col}`}
                onDrop={(source) => handleDropToTableau(source, col)}
              />
            ))}
          </View>
        </View>
      </DragContainer>
    </DragProvider>
  );
}

const styles = StyleSheet.create({
  board: {
    alignItems: "center",
    gap: ROW_GAP,
  },
  topRow: {
    flexDirection: "row",
    gap: COL_GAP,
    width: BOARD_WIDTH,
  },
  tableau: {
    flexDirection: "row",
    gap: COL_GAP,
    alignItems: "flex-start",
  },
});
