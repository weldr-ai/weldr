"use client";

import type { RouterOutputs } from "@integramind/api";
import { createContext, useContext } from "react";

export const ResourcesContext = createContext<
  (RouterOutputs["projects"]["byId"]["resources"][0] & {
    metadata?: unknown;
  })[]
>([]);

export function useResources() {
  return useContext(ResourcesContext);
}

export function ResourcesProvider({
  children,
  resources,
}: {
  children: React.ReactNode;
  resources: (RouterOutputs["projects"]["byId"]["resources"][0] & {
    metadata?: unknown;
  })[];
}) {
  return (
    <ResourcesContext.Provider value={resources}>
      {children}
    </ResourcesContext.Provider>
  );
}
