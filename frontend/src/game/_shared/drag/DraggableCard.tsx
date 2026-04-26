import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useSharedValue, runOnJS } from "react-native-reanimated";
import { useDragContext, isCardInDragStack } from "./DragContext";
import type { DragCard, DragSource } from "./DragContext";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

export interface DraggableCardProps {
  children: React.ReactNode;
  style?: object;
  /** Tap fallback — same behavior as the old onPress. */
  onTap?: () => void;
  /** The card(s) that will be dragged. For a tableau run, pass all cards
   *  from fromIndex to end of pile. */
  dragCards: DragCard[];
  /** Identifies this card in the drag system. */
  dragSource: DragSource;
  /** Set false for face-down cards that cannot be picked up. */
  draggable?: boolean;
}

export function DraggableCard({
  children,
  style,
  onTap,
  dragCards,
  dragSource,
  draggable = true,
}: DraggableCardProps) {
  const viewRef = useRef<View>(null);

  // Pre-measured card position in window coordinates, updated on every layout.
  // Stored as shared values so the pan worklet can read them synchronously.
  const cachedPageX = useSharedValue(0);
  const cachedPageY = useSharedValue(0);

  const {
    dragState,
    cardX,
    cardY,
    originX,
    originY,
    containerOffsetX,
    containerOffsetY,
    startDrag,
    endDrag,
    snapBackAndClear,
  } = useDragContext();

  // Re-measure on every layout change (handles initial render + orientation).
  const onLayout = useCallback(() => {
    viewRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
      cachedPageX.value = pageX;
      cachedPageY.value = pageY;
    });
  }, [cachedPageX, cachedPageY]);

  // Called from worklet via runOnJS to update React state.
  const triggerStartDrag = useCallback(() => {
    startDrag(dragSource, dragCards);
  }, [dragSource, dragCards, startDrag]);

  const pan = Gesture.Pan()
    .minDistance(8)
    .enabled(draggable)
    .onStart(() => {
      "worklet";
      // Convert window position to container-local coordinates.
      const localX = cachedPageX.value - containerOffsetX.value;
      const localY = cachedPageY.value - containerOffsetY.value;
      originX.value = localX;
      originY.value = localY;
      cardX.value = localX;
      cardY.value = localY;
      runOnJS(triggerStartDrag)();
    })
    .onUpdate((e) => {
      "worklet";
      cardX.value = originX.value + e.translationX;
      cardY.value = originY.value + e.translationY;
    })
    .onEnd((e) => {
      "worklet";
      runOnJS(endDrag)(e.absoluteX, e.absoluteY);
    })
    .onFinalize((_e, success) => {
      "worklet";
      if (!success) runOnJS(snapBackAndClear)();
    });

  const tap = Gesture.Tap().onEnd(() => {
    "worklet";
    if (onTap) runOnJS(onTap)();
  });

  const gesture = draggable ? Gesture.Race(pan, tap) : tap;

  // Hide this card when it (or a card above it in the same run) is being dragged —
  // the DragOverlay renders the visual at the finger position instead.
  const beingDragged = dragState !== null && isCardInDragStack(dragState.source, dragSource);

  // Clone the child to inject onPress so that:
  //   • In production: GestureDetector (RNGH) intercepts touches before the inner
  //     Pressable sees them — no double-firing.
  //   • In tests: RNGH is mocked so GestureDetector does nothing; the inner
  //     Pressable's onPress fires normally, keeping fireEvent.press working.
  const child = React.Children.only(children) as React.ReactElement<AnyProps>;
  const innerEl = onTap ? React.cloneElement(child, { onPress: onTap }) : child;

  return (
    <View ref={viewRef} style={[style, beingDragged && { opacity: 0 }]} onLayout={onLayout}>
      <GestureDetector gesture={gesture}>{innerEl}</GestureDetector>
    </View>
  );
}
