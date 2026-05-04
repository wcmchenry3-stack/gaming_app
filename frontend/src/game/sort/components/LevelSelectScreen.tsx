import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../../theme/ThemeContext";
import { typography } from "../../../theme/typography";
import type { LevelData } from "../api";
import type { SortProgress } from "../storage";

const COLS = 4;

interface Props {
  readonly levels: LevelData[];
  readonly progress: SortProgress;
  readonly onSelectLevel: (id: number) => void;
  readonly onContinue: () => void;
}

export default function LevelSelectScreen({
  levels,
  progress,
  onSelectLevel,
  onContinue,
}: Props) {
  const { t } = useTranslation("sort");
  const { colors } = useTheme();

  const hasContinue =
    progress.currentLevelId !== null && progress.currentState !== null;

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      <Text style={[styles.title, { color: colors.text }]}>
        {t("levelSelect.title")}
      </Text>

      {hasContinue && (
        <Pressable
          style={[styles.continueBtn, { backgroundColor: colors.accent }]}
          onPress={onContinue}
          accessibilityRole="button"
          accessibilityLabel={t("levelSelect.continue", {
            level: progress.currentLevelId,
          })}
        >
          <Text style={[styles.continueBtnText, { color: colors.textOnAccent }]}>
            {t("levelSelect.continue", { level: progress.currentLevelId })}
          </Text>
        </Pressable>
      )}

      <View style={styles.grid}>
        {levels.map((level) => {
          const isUnlocked = level.id <= progress.unlockedLevel;
          return (
            <Pressable
              key={level.id}
              style={[
                styles.card,
                {
                  backgroundColor: isUnlocked
                    ? colors.surfaceHigh
                    : colors.surface,
                  borderColor: isUnlocked ? colors.accent : colors.border,
                  opacity: isUnlocked ? 1 : 0.5,
                },
              ]}
              onPress={isUnlocked ? () => onSelectLevel(level.id) : undefined}
              accessibilityRole="button"
              accessibilityLabel={
                isUnlocked
                  ? t("hud.level", { level: level.id })
                  : t("levelSelect.locked")
              }
              accessibilityState={{ disabled: !isUnlocked }}
            >
              {isUnlocked ? (
                <Text style={[styles.levelNum, { color: colors.text }]}>
                  {level.id}
                </Text>
              ) : (
                <>
                  <Text style={[styles.levelNum, { color: colors.textMuted }]}>
                    {level.id}
                  </Text>
                  <Text style={styles.lockIcon}>🔒</Text>
                </>
              )}
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const CARD_SIZE = `${Math.floor(100 / COLS)}%` as `${number}%`;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    gap: 16,
  },
  title: {
    fontFamily: typography.heading,
    fontSize: 20,
    textAlign: "center",
    marginBottom: 8,
  },
  continueBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  continueBtnText: {
    fontFamily: typography.label,
    fontSize: 14,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  card: {
    width: CARD_SIZE,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  levelNum: {
    fontFamily: typography.heading,
    fontSize: 18,
    fontWeight: "700",
  },
  lockIcon: {
    fontSize: 12,
  },
});
