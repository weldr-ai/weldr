"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

interface CommandCenterContextType {
  open: {
    isOpen: boolean;
    mode?: "create-project" | undefined;
  };
  setOpen: (open: {
    isOpen: boolean;
    mode?: "create-project" | undefined;
  }) => void;
}

const CommandCenterContext = createContext<
  CommandCenterContextType | undefined
>(undefined);

export function CommandCenterProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState({ isOpen: false });

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

// Chat Context
interface ChatContextType {
  isCollapsed: boolean;
  toggleCollapsed: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const toggleCollapsed = () => setIsCollapsed((prev) => !prev);

  return (
    <ChatContext.Provider value={{ isCollapsed, toggleCollapsed }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  return (
    <CommandCenterProvider>
      <FlowBuilderProvider>
        <ChatProvider>{children}</ChatProvider>
      </FlowBuilderProvider>
    </CommandCenterProvider>
  );
}
