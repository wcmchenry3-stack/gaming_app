import React from "react";
import { Pressable, Text, StyleSheet, View } from "react-native";

interface DieProps {
  value: number;
  held: boolean;
  onPress: () => void;
  disabled: boolean;
}

export default function Die({ value, held, onPress, disabled }: DieProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.die,
        held && styles.held,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.value}>{value > 0 ? value : "—"}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  die: {
    width: 56,
    height: 56,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#ccc",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    margin: 6,
  },
  held: {
    borderColor: "#2563eb",
    backgroundColor: "#dbeafe",
  },
  disabled: {
    opacity: 0.4,
  },
  value: {
    fontSize: 26,
    fontWeight: "700",
    color: "#1e293b",
  },
});
