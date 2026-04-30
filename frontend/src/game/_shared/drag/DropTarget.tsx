import React, { useCallback, useEffect, useRef } from "react";
import { View } from "react-native";
import type { ViewStyle } from "react-native";
import { useDragContext } from "./DragContext";
import type { DropHandler } from "./DragContext";

export interface DropTargetProps {
  /** Unique ID used to match against legalTargetIds. */
  id: string;
  onDrop: DropHandler;
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** Style applied on top of `style` when drag is active AND this is legal. */
  highlightStyle?: ViewStyle;
  /** Style applied on top of `style` when drag is active AND this is not legal. */
  dimStyle?: ViewStyle;
}

export function DropTarget({
  id,
  onDrop,
  children,
  style,
  highlightStyle,
  dimStyle,
}: DropTargetProps) {
  const viewRef = useRef<View>(null);
  const boundsRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);

  // Keep the latest onDrop in a ref so re-renders don't force re-registration.
  const onDropRef = useRef(onDrop);
  useEffect(() => {
    onDropRef.current = onDrop;
  });

  const { dragState, legalTargetIds, registerDropZone, unregisterDropZone } = useDragContext();

  const getMeasurement = useCallback(() => boundsRef.current, []);

  const onLayout = useCallback(() => {
    // measureInWindow is more reliable than measure on iOS for absolute window coordinates.
    viewRef.current?.measureInWindow((x, y, w, h) => {
      boundsRef.current = { x, y, width: w, height: h };
    });
  }, []);

  useEffect(() => {
    registerDropZone(id, {
      getMeasurement,
      onDrop: (source, cards) => onDropRef.current(source, cards),
    });
    return () => unregisterDropZone(id);
  }, [id, getMeasurement, registerDropZone, unregisterDropZone]);

  const isDragActive = dragState !== null;
  const isLegal = legalTargetIds.has(id);

  const overlayStyle = isDragActive ? (isLegal ? highlightStyle : dimStyle) : undefined;

  return (
    <View ref={viewRef} style={[style, overlayStyle]} onLayout={onLayout}>
      {children}
    </View>
  );
}
