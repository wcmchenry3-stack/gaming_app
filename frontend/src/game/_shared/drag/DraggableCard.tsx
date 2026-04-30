import React, { useCallback } from "react";
import { Platform } from "react-native";
import Animated, { useAnimatedRef, measure as rnMeasure } from "react-native-reanimated";
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
  // useAnimatedRef lets worklets call rnMeasure(viewRef) for reliable iOS position reads.
  const viewRef = useAnimatedRef<Animated.View>();

  const {
    dragState,
    cardX,
    cardY,
    originX,
    originY,
    containerOffsetX,
    containerOffsetY,
    containerRef,
    startDrag,
    endDrag,
    snapBackAndClear,
  } = useDragContext();

  const triggerStartDrag = useCallback(() => {
    startDrag(dragSource, dragCards);
  }, [dragSource, dragCards, startDrag]);

  const panActivated = useSharedValue(false);

  const pan = Gesture.Pan()
    .minDistance(8)
    .enabled(draggable)
    .onStart(() => {
      "worklet";
      panActivated.value = true;
      // Measure card and container fresh on every drag start — avoids stale/zero
      // values that measure() can return on the first iOS layout pass.
      const cardMeasured = rnMeasure(viewRef);
      const containerMeasured = rnMeasure(containerRef);
      if (!cardMeasured) return;
      // Re-sync the container offset in case DragContainer.onLayout hasn't fired yet.
      if (containerMeasured) {
        containerOffsetX.value = containerMeasured.pageX;
        containerOffsetY.value = containerMeasured.pageY;
      }
      const localX = cardMeasured.pageX - containerOffsetX.value;
      const localY = cardMeasured.pageY - containerOffsetY.value;
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
      if (!success && panActivated.value) runOnJS(snapBackAndClear)();
      panActivated.value = false;
    });

  // maxDistance matches pan's minDistance: touch that moves < 8 px is a tap; >= 8 px is a drag.
  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((_e, success) => {
      "worklet";
      if (success && onTap) runOnJS(onTap)();
    });

  // iOS RNGH 2.30.0: Gesture.Race blocked tap because the native recogniser
  // kept tap in "possible" while pan was also possible, preventing tap from
  // ever activating. requireExternalGestureToFail(pan) declares the direction
  // explicitly — tap waits for pan to fail before it can fire, letting pan run
  // freely without the recogniser deadlock that bare Simultaneous caused.
  const gesture = draggable
    ? Gesture.Simultaneous(pan, Platform.OS === "ios" ? tap.requireExternalGestureToFail(pan) : tap)
    : tap;

  const beingDragged = dragState !== null && isCardInDragStack(dragState.source, dragSource);

  const child = React.Children.only(children) as React.ReactElement<AnyProps>;
  const innerEl = onTap ? React.cloneElement(child, { onPress: onTap }) : child;

  return (
    <Animated.View ref={viewRef} style={[style, beingDragged && { opacity: 0 }]}>
      <GestureDetector gesture={gesture}>{innerEl}</GestureDetector>
    </Animated.View>
  );
}
