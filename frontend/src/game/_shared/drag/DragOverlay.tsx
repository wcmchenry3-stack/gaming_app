import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import SharedPlayingCard from "../../../components/shared/PlayingCard";
import { useDragContext } from "./DragContext";

const STACK_OFFSET = 24;

/** Floating card stack that follows the user's finger during a drag.
 *  Rendered inside DragContainer as a sibling of the game board so it
 *  is never clipped by overflow:hidden descendants. */
export function DragOverlay() {
  const { dragState, cardX, cardY } = useDragContext();

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cardX.value }, { translateY: cardY.value }],
  }));

  if (!dragState) return null;

  const { cards } = dragState;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.overlay, animStyle]}>
        {cards.map((card, i) => (
          <View key={i} style={[styles.card, { top: i * STACK_OFFSET }]}>
            <SharedPlayingCard
              suit={card.suit}
              rank={card.rank}
              faceDown={card.faceDown ?? false}
              width={card.width}
              height={card.height}
            />
          </View>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    // Elevation / shadow for "lifted" appearance.
    elevation: 12,
    shadowColor: "#000",
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
  },
  card: {
    position: "absolute",
  },
});
