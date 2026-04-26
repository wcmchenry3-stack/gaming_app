import { useEffect, useRef } from "react";

type GameEventHandlers<T extends { readonly type: string }> = {
  [K in T["type"]]?: (event: Extract<T, { type: K }>) => void;
};

/**
 * Fires registered callbacks for each unprocessed event in `events`, then
 * calls `onClear` so the caller can clear the array from game state.
 *
 * Identity-based deduplication: the same array reference is never processed
 * twice, so re-renders between the effect firing and the state update are safe.
 */
export function useGameEvents<T extends { readonly type: string }>(
  events: readonly T[] | undefined,
  handlers: GameEventHandlers<T>,
  onClear: () => void
): void {
  const handlersRef = useRef(handlers);
  const onClearRef = useRef(onClear);
  const lastProcessedRef = useRef<readonly T[] | undefined>(undefined);

  // Keep refs current without adding them to the effect dep array.
  useEffect(() => {
    handlersRef.current = handlers;
    onClearRef.current = onClear;
  });

  useEffect(() => {
    if (!events || events.length === 0 || events === lastProcessedRef.current) return;
    lastProcessedRef.current = events;
    for (const event of events) {
      const handler = handlersRef.current[event.type as T["type"]] as ((e: T) => void) | undefined;
      handler?.(event);
    }
    onClearRef.current();
  }, [events]);
}
