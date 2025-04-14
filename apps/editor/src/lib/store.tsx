"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type CommandCenterView = "create" | "projects";

interface CommandCenterContextType {
  open: boolean;
  view: CommandCenterView;
  setOpen: (open: boolean) => void;
  setView: (view: CommandCenterView) => void;
}

const CommandCenterContext = createContext<
  CommandCenterContextType | undefined
>(undefined);

export function CommandCenterProvider({
  children,
  activeView,
}: {
  children: ReactNode;
  activeView?: CommandCenterView;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<CommandCenterView>(activeView ?? "projects");

  return (
    <CommandCenterContext.Provider value={{ open, view, setOpen, setView }}>
      {children}
    </CommandCenterContext.Provider>
  );
}

export function useCommandCenter(activeView?: CommandCenterView) {
  const context = useContext(CommandCenterContext);

  if (context === undefined) {
    throw new Error(
      "useCommandCenter must be used within a CommandCenterProvider",
    );
  }

  const { setView } = context;

  useEffect(() => {
    if (activeView) {
      setView(activeView);
    }
  }, [activeView, setView]);

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
