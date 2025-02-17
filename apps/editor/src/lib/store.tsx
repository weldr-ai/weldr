"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

interface CommandCenterContextType {
  open: "create" | "view" | null;
  setOpen: (open: "create" | "view" | null) => void;
}

const CommandCenterContext = createContext<
  CommandCenterContextType | undefined
>(undefined);

export function CommandCenterProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<"create" | "view" | null>(null);

  return (
    <CommandCenterContext.Provider value={{ open, setOpen }}>
      {children}
    </CommandCenterContext.Provider>
  );
}

export function useCommandCenter() {
  const context = useContext(CommandCenterContext);
  if (context === undefined) {
    throw new Error(
      "useCommandCenter must be used within a CommandCenterProvider",
    );
  }
  return context;
}

interface FlowBuilderContextType {
  showEdges: boolean;
  toggleEdges: () => void;
}

const FlowBuilderContext = createContext<FlowBuilderContextType | undefined>(
  undefined,
);

export function FlowBuilderProvider({ children }: { children: ReactNode }) {
  const [showEdges, setShowEdges] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("flowBuilder.showEdges");
    if (stored !== null) {
      setShowEdges(stored === "true");
    }
    setIsInitialized(true);
  }, []);

  const toggleEdges = () => {
    setShowEdges((prev) => {
      const newValue = !prev;
      localStorage.setItem("flowBuilder.showEdges", String(newValue));
      return newValue;
    });
  };

  if (!isInitialized) {
    return null;
  }

  return (
    <FlowBuilderContext.Provider value={{ showEdges, toggleEdges }}>
      {children}
    </FlowBuilderContext.Provider>
  );
}

export function useFlowBuilder() {
  const context = useContext(FlowBuilderContext);
  if (context === undefined) {
    throw new Error("useFlowBuilder must be used within a FlowBuilderProvider");
  }
  return context;
}

// Project Context
interface ProjectContextType {
  project: {
    id: string;
    name: string | null;
  };
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({
  children,
  project,
}: {
  children: ReactNode;
  project: {
    id: string;
    name: string | null;
  };
}) {
  return (
    <ProjectContext.Provider value={{ project }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}

export function AppStateProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <CommandCenterProvider>
      <FlowBuilderProvider>{children}</FlowBuilderProvider>
    </CommandCenterProvider>
  );
}
