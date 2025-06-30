"use client";

import type { RouterOutputs } from "@weldr/api";
import { createContext, useContext } from "react";

type Version = RouterOutputs["versions"]["list"][number];

interface CurrentVersionContextType {
  currentVersion: Version | null;
}

const CurrentVersionContext = createContext<CurrentVersionContextType | null>(
  null,
);

interface CurrentVersionProviderProps {
  children: React.ReactNode;
  currentVersion: Version | null;
}

export function CurrentVersionProvider({
  children,
  currentVersion,
}: CurrentVersionProviderProps) {
  const value: CurrentVersionContextType = {
    currentVersion,
  };

  return (
    <CurrentVersionContext.Provider value={value}>
      {children}
    </CurrentVersionContext.Provider>
  );
}

export function useCurrentVersion() {
  const context = useContext(CurrentVersionContext);
  if (!context) {
    throw new Error(
      "useCurrentVersion must be used within a CurrentVersionProvider",
    );
  }
  return context;
}
