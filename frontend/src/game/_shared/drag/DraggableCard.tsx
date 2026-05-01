import React, { useCallback } from "react";
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

  // For non-draggable (face-down) cards, RNGH tap works correctly and is unchanged.
  // For draggable cards, pan-only in GestureDetector: when pan fails (< 8 px movement),
  // the touch is released and the native onPress cloned onto the child below handles tap.
  // This avoids the Simultaneous/requireExternalGestureToFail iOS UIGestureRecognizer
  // deadlock that kept both tap and drag broken (#1101, #1102).
  const tap = Gesture.Tap()
    .maxDistance(8)
    .onEnd((_e, success) => {
      "worklet";
      if (success && onTap) runOnJS(onTap)();
    });

  const gesture = draggable ? pan : tap;

  const beingDragged = dragState !== null && isCardInDragStack(dragState.source, dragSource);

  const child = React.Children.only(children) as React.ReactElement<AnyProps>;
  const innerEl = onTap ? React.cloneElement(child, { onPress: onTap }) : child;

  return (
    <Animated.View ref={viewRef} style={[style, beingDragged && { opacity: 0 }]}>
      <GestureDetector gesture={gesture}>{innerEl}</GestureDetector>
    </Animated.View>
  );
}
