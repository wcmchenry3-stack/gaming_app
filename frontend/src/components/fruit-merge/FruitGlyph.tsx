import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { FruitDefinition } from "../../theme/fruitSets";

interface Props {
  fruit: FruitDefinition;
  size: number;
}

export default function FruitGlyph({ fruit, size }: Props) {
  if (fruit.icon) {
    return (
      <View
        style={[
          styles.iconFrame,
          {
            width: size,
            height: size,
          },
        ]}
        importantForAccessibility="no"
      >
        <Image
          source={fruit.icon}
          style={styles.icon}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <Text style={{ fontSize: size }} importantForAccessibility="no">
      {fruit.emoji}
    </Text>
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
});
