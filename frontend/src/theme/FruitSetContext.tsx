import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { FruitSet, FRUIT_SETS, DEFAULT_FRUIT_SET } from "./fruitSets";

const STORAGE_KEY = "gaming_app_fruit_set";

interface FruitSetContextValue {
  activeFruitSet: FruitSet;
  setFruitSetById: (id: string) => void;
}

const FruitSetContext = createContext<FruitSetContextValue>({
  activeFruitSet: FRUIT_SETS[DEFAULT_FRUIT_SET],
  setFruitSetById: () => {},
});

export function FruitSetProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveId] = useState<string>(DEFAULT_FRUIT_SET);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        // Migrate legacy theme ids
        const migrated = stored === "planets" ? "cosmos" : stored;
        if (FRUIT_SETS[migrated]) {
          setActiveId(migrated);
          if (migrated !== stored) AsyncStorage.setItem(STORAGE_KEY, migrated);
        }
      })
      .catch(() => {});
  }, []);

  function setFruitSetById(id: string) {
    if (!FRUIT_SETS[id]) return;
    AsyncStorage.setItem(STORAGE_KEY, id);
    setActiveId(id);
  }

  return (
    <FruitSetContext.Provider value={{ activeFruitSet: FRUIT_SETS[activeId], setFruitSetById }}>
      {children}
    </FruitSetContext.Provider>
  );
}

export function useFruitSet() {
  return useContext(FruitSetContext);
}
