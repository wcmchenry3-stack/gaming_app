import React from "react";
import { Modal, View, Text, Pressable, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../theme/ThemeContext";
import PlayerHand from "./PlayerHand";
import type { Card, PassDirection } from "../../game/hearts/types";

interface Props {
  hand: Card[];
  passDirection: PassDirection;
  selectedCards: Card[];
  onCardPress: (card: Card) => void;
  onConfirm: () => void;
}

export default function PassingOverlay({
  hand,
  passDirection,
  selectedCards,
  onCardPress,
  onConfirm,
}: Props) {
  const { t } = useTranslation("hearts");
  const { colors } = useTheme();

  const direction = t(`pass.direction.${passDirection}`);
  const canConfirm = selectedCards.length === 3;

  return (
    <Modal visible transparent animationType="fade" accessibilityViewIsModal>
      <View style={[styles.backdrop, { backgroundColor: "rgba(0,0,0,0.75)" }]}>
        <View
          style={[styles.panel, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Text style={[styles.instructions, { color: colors.text }]}>
            {t("pass.instructions", { direction })}
          </Text>
          <Text style={[styles.selected, { color: colors.textMuted }]}>
            {t("pass.selected", { count: selectedCards.length })}
          </Text>
          <PlayerHand hand={hand} selectedCards={selectedCards} onCardPress={onCardPress} />
          <Pressable
            style={[
              styles.confirmButton,
              {
                backgroundColor: canConfirm ? colors.accent : colors.surfaceAlt,
                borderColor: colors.border,
              },
            ]}
            onPress={canConfirm ? onConfirm : undefined}
            disabled={!canConfirm}
            accessibilityLabel={t("pass.confirmLabel", { count: selectedCards.length })}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canConfirm }}
          >
            <Text
              style={[
                styles.confirmText,
                { color: canConfirm ? colors.surface : colors.textMuted },
              ]}
            >
              {t("pass.confirm")}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  panel: {
    width: "90%",
    maxWidth: 480,
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    gap: 16,
    alignItems: "center",
  },
  instructions: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  selected: {
    fontSize: 14,
  },
  confirmButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
  },
  confirmText: {
    fontSize: 16,
    fontWeight: "700",
  },
});
