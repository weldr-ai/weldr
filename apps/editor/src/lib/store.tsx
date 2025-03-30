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

interface CanvasContextType {
  showEdges: boolean;
  toggleEdges: () => void;
}

const CanvasContext = createContext<CanvasContextType | undefined>(undefined);

export function CanvasProvider({ children }: { children: ReactNode }) {
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
    <CanvasContext.Provider value={{ showEdges, toggleEdges }}>
      {children}
    </CanvasContext.Provider>
  );
}

export function useCanvas() {
  const context = useContext(CanvasContext);
  if (context === undefined) {
    throw new Error("useCanvas must be used within a CanvasProvider");
  }
  return context;
}

// Project Context
interface ProjectContextType {
  project: {
    id: string;
    name: string | null;
    currentVersion:
      | {
          id: string;
          number: number;
          message: string;
          machineId: string | null;
        }
      | undefined;
  };
  setProject: (project: {
    id: string;
    name: string | null;
    currentVersion:
      | {
          id: string;
          number: number;
          message: string;
          machineId: string | null;
        }
      | undefined;
  }) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({
  children,
  initialProject,
}: {
  children: ReactNode;
  initialProject: {
    id: string;
    name: string | null;
    currentVersion:
      | {
          id: string;
          number: number;
          message: string;
          machineId: string | null;
        }
      | undefined;
  };
}) {
  const [project, setProject] = useState(initialProject);

  return (
    <ProjectContext.Provider value={{ project, setProject }}>
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
      <CanvasProvider>{children}</CanvasProvider>
    </CommandCenterProvider>
  );
}
