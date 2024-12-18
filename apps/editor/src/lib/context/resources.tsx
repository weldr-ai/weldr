"use client";

import { createContext, useContext } from "react";

export const ResourcesContext = createContext<
  {
    id: string;
    name: string;
    integrationType: "postgres" | "mysql";
    metadata?: unknown;
  }[]
>([]);

export function useResources() {
  return useContext(ResourcesContext);
}

export function ResourcesProvider({
  children,
  resources,
}: {
  children: React.ReactNode;
  resources: {
    id: string;
    name: string;
    integrationType: "postgres" | "mysql";
    metadata?: unknown;
  }[];
}) {
  return (
    <ResourcesContext.Provider value={resources}>
      {children}
    </ResourcesContext.Provider>
  );
}
