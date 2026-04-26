import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";

import { SUITS } from "../../game/freecell/types";
import { validateMove } from "../../game/freecell/engine";
import type { FreeCellState, Move, Suit } from "../../game/freecell/types";
import FreeCellSlot, { CARD_WIDTH } from "./FreeCellSlot";
import FoundationPile from "./FoundationPile";
import TableauColumn from "./TableauColumn";

const TABLEAU_COLS = 8;
const COL_GAP = 4;
const SLOT_GAP = 6;
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

  function handleFoundationPress(suit: Suit) {
    if (selection === null) return;
    if (selection.kind === "tableau") {
      tryMove({ type: "tableau-to-foundation", fromCol: selection.col });
    } else {
      tryMove({ type: "freecell-to-foundation", fromCell: selection.cell });
    }
  }

  return (
    <View
      style={styles.board}
      accessibilityRole="none"
      accessibilityLabel={t("a11y.boardRegion")}
    >
      <View style={styles.topRow}>
        <View style={styles.slotGroup}>
          {state.freeCells.map((card, i) => (
            <FreeCellSlot
              key={i}
              card={card}
              cellIndex={i}
              selected={selection?.kind === "freecell" && selection.cell === i}
              onPress={handleFreeCellPress}
            />
          ))}
        </View>
        <View style={styles.slotGroup}>
          {SUITS.map((suit) => (
            <FoundationPile
              key={suit}
              pile={state.foundations[suit]}
              suit={suit}
              selected={false}
              onPress={handleFoundationPress}
            />
          ))}
        </View>
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
            onCardPress={handleTableauCardPress}
            onEmptyPress={handleTableauEmptyPress}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: {
    alignItems: "center",
    gap: ROW_GAP,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: BOARD_WIDTH,
  },
  slotGroup: {
    flexDirection: "row",
    gap: SLOT_GAP,
  },
  tableau: {
    flexDirection: "row",
    gap: COL_GAP,
    alignItems: "flex-start",
  },
});
