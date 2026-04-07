import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { FruitDefinition } from "../../theme/fruitSets";

interface Props {
  fruit: FruitDefinition;
  size: number;
}

export default function FruitGlyph({ fruit, size }: Props) {
  if (fruit.icon) {
    return (
      <View
        style={[styles.iconFrame, { width: size, height: size }]}
        importantForAccessibility="no"
      >
        <Image
          source={fruit.icon}
          style={styles.icon}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
          onError={() => console.warn(`FruitGlyph: failed to load icon for "${fruit.name}"`)}
        />
      </View>
    );
  }

  // No icon configured — colored circle fallback.
  return (
    <View
      style={[
        styles.colorCircle,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: fruit.color },
      ]}
      importantForAccessibility="no"
    />
  );
}

const styles = StyleSheet.create({
  iconFrame: {
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    width: "100%",
    height: "100%",
  },
  colorCircle: {},
});
