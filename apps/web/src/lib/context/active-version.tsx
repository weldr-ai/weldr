"use client";

import type { versions } from "@weldr/db/schema";
import { createContext, useContext } from "react";

type Version = typeof versions.$inferSelect;

interface ActiveVersionContextType {
  activeVersion: Version | null;
}

const ActiveVersionContext = createContext<ActiveVersionContextType | null>(
  null,
);

interface ActiveVersionProviderProps {
  children: React.ReactNode;
  activeVersion: Version | null;
}

export function ActiveVersionProvider({
  children,
  activeVersion,
}: ActiveVersionProviderProps) {
  const value: ActiveVersionContextType = {
    activeVersion,
  };

  return (
    <ActiveVersionContext.Provider value={value}>
      {children}
    </ActiveVersionContext.Provider>
  );
}

export function useActiveVersion() {
  const context = useContext(ActiveVersionContext);
  if (!context) {
    throw new Error(
      "useActiveVersion must be used within an ActiveVersionProvider",
    );
  }
  return context;
}
