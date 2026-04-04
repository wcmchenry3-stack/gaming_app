/**
 * App-wide offline state + automatic queue flushing on reconnect.
 *
 * Wraps the tree so any component can call `useNetwork()` to get
 * `{ isOnline, isInitialized }`. Internally watches for offline→online
 * transitions and flushes the pending score queue exactly once per
 * reconnect edge.
 */

import React, { createContext, useContext, useEffect, useRef } from "react";
import * as Sentry from "@sentry/react-native";
import { NetworkStatus, useNetworkStatus } from "./useNetworkStatus";
import { scoreQueue } from "./scoreQueue";
import { registerCascadeScoreHandler } from "../cascade/scoreSync";

const NetworkContext = createContext<NetworkStatus>({
  isOnline: true,
  isInitialized: false,
});

// Register per-game handlers exactly once, module-load time.
registerCascadeScoreHandler();

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const status = useNetworkStatus();
  const wasOnlineRef = useRef<boolean>(status.isOnline);

  useEffect(() => {
    const prev = wasOnlineRef.current;
    wasOnlineRef.current = status.isOnline;
    // Trigger flush on the offline → online edge (only after init so the
    // initial "true → true" mount isn't misread as a reconnect).
    if (status.isInitialized && !prev && status.isOnline) {
      scoreQueue.flush().catch((e) => {
        Sentry.captureException(e, { tags: { subsystem: "scoreQueue", op: "flush-on-reconnect" } });
      });
    }
  }, [status.isOnline, status.isInitialized]);

  return <NetworkContext.Provider value={status}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkStatus {
  return useContext(NetworkContext);
}
