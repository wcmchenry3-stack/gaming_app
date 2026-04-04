/**
 * NetInfo-backed hook exposing live network connectivity state.
 *
 * `isOnline` is conservatively false until NetInfo reports a definite
 * online state. `isInitialized` flips true after the first NetInfo
 * event so UI can avoid flashing an "offline" banner at boot.
 */

import NetInfo, { NetInfoState } from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  isInitialized: boolean;
}

function toOnline(state: NetInfoState): boolean {
  // `isInternetReachable` can be null on some platforms before the first
  // reachability check completes. Treat null as "assume reachable" when
  // `isConnected` is true — otherwise we'd flash offline on every boot.
  if (!state.isConnected) return false;
  return state.isInternetReachable !== false;
}

export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    isInitialized: false,
  });

  useEffect(() => {
    let cancelled = false;
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (cancelled) return;
      setStatus({ isOnline: toOnline(state), isInitialized: true });
    });
    // Also do an immediate fetch in case the listener hasn't fired yet.
    NetInfo.fetch().then((state) => {
      if (cancelled) return;
      setStatus({ isOnline: toOnline(state), isInitialized: true });
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  return status;
}
