"use client";

import type { Resource } from "@integramind/shared/types";
import { createContext, useContext } from "react";

export const ResourcesContext = createContext<
  (Resource & { metadata?: unknown })[]
>([]);

export function useResources() {
  return useContext(ResourcesContext);
}

export function ResourcesProvider({
  children,
  resources,
}: {
  children: React.ReactNode;
  resources: (Resource & { metadata?: unknown })[];
}) {
  return (
    <ResourcesContext.Provider value={resources}>
      {children}
    </ResourcesContext.Provider>
  );
}
