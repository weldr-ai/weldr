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

// View Context
interface ViewContextType {
  activeTab: "chat" | "history" | null;
  setActiveTab: (activeTab: "chat" | "history" | null) => void;
}

const ViewContext = createContext<ViewContextType | undefined>(undefined);

export function ViewProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<"chat" | "history" | null>("chat");

  return (
    <ViewContext.Provider value={{ activeTab, setActiveTab }}>
      {children}
    </ViewContext.Provider>
  );
}

export function useView() {
  const context = useContext(ViewContext);
  if (context === undefined) {
    throw new Error("useView must be used within a ViewProvider");
  }
  return context;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  return (
    <CommandCenterProvider>
      <FlowBuilderProvider>
        <ViewProvider>{children}</ViewProvider>
      </FlowBuilderProvider>
    </CommandCenterProvider>
  );
}
