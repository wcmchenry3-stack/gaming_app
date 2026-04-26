import React, { useCallback, useRef } from "react";
import { View } from "react-native";
import type { LayoutChangeEvent, ViewStyle } from "react-native";
import { useDragContext } from "./DragContext";
import { DragOverlay } from "./DragOverlay";

/**
 * Drop-in replacement for a plain View that:
 *   1. Measures its own position and keeps the context's containerOffset shared
 *      values up to date so DraggableCard worklets can compute container-local
 *      card positions.
 *   2. Renders the DragOverlay as a sibling of its children (so the overlay
 *      is not clipped by any overflow:hidden descendant).
 */
export interface DragContainerProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onLayout?: (e: LayoutChangeEvent) => void;
}

export function DragContainer({ children, style, onLayout: externalOnLayout }: DragContainerProps) {
  const viewRef = useRef<View>(null);
  const { containerOffsetX, containerOffsetY } = useDragContext();

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => {
      viewRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
        containerOffsetX.value = pageX;
        containerOffsetY.value = pageY;
      });
      externalOnLayout?.(e);
    },
    [containerOffsetX, containerOffsetY, externalOnLayout]
  );

  return (
    <View ref={viewRef} style={style} onLayout={onLayout}>
      {children}
      <DragOverlay />
    </View>
  );
}
