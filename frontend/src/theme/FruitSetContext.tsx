import React, { createContext, useContext, useState } from "react";
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
  const [activeId, setActiveId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored && FRUIT_SETS[stored] ? stored : DEFAULT_FRUIT_SET;
    } catch {
      return DEFAULT_FRUIT_SET;
    }
  });

  function setFruitSetById(id: string) {
    if (!FRUIT_SETS[id]) return;
    try { localStorage.setItem(STORAGE_KEY, id); } catch {}
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
