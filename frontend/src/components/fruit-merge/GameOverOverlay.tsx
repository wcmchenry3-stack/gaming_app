import React, { useState } from "react";
import {
  View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Modal,
} from "react-native";
import { fruitMergeApi, ScoreEntry } from "../../api/fruitMergeClient";
import { useTheme } from "../../theme/ThemeContext";

interface Props {
  score: number;
  onRestart: () => void;
}

export default function GameOverOverlay({ score, onRestart }: Props) {
  const { colors } = useTheme();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<ScoreEntry | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const entry = await fruitMergeApi.submitScore(name.trim(), score);
      setSubmitted(entry);
    } catch {
      setError("Could not save score. Check your connection.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.modalBg, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Game Over</Text>
          <Text style={[styles.score, { color: colors.accent }]}>{score.toLocaleString()}</Text>
          <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>points</Text>

          {!submitted ? (
            <>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
                placeholder="Enter your name"
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                maxLength={32}
                editable={!submitting}
              />
              {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
              <Pressable
                style={[styles.btn, { backgroundColor: colors.accent, opacity: submitting ? 0.6 : 1 }]}
                onPress={handleSubmit}
                disabled={submitting || !name.trim()}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>Save Score</Text>
                }
              </Pressable>
            </>
          ) : (
            <Text style={[styles.saved, { color: colors.bonus }]}>
              Saved! #{submitted.score.toLocaleString()}
            </Text>
          )}

          <Pressable
            style={[styles.restartBtn, { borderColor: colors.border }]}
            onPress={onRestart}
          >
            <Text style={[styles.restartText, { color: colors.textMuted }]}>Play Again</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 20,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    gap: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  score: {
    fontSize: 52,
    fontWeight: "800",
    lineHeight: 56,
  },
  scoreLabel: {
    fontSize: 14,
    marginTop: -8,
  },
  input: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    fontSize: 16,
    marginTop: 8,
  },
  error: {
    fontSize: 13,
  },
  btn: {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },
  btnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  saved: {
    fontSize: 18,
    fontWeight: "700",
    marginTop: 4,
  },
  restartBtn: {
    marginTop: 4,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
  },
  restartText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
