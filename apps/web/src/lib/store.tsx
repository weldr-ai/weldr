"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type CommandCenterView = "create" | "projects";

interface UIStoreContextType {
  // Auth Dialog
  authDialogOpen: boolean;
  setAuthDialogOpen: (open: boolean) => void;
  authDialogView: "sign-in" | "sign-up";
  setAuthDialogView: (view: "sign-in" | "sign-up") => void;

  // Account Settings
  accountSettingsOpen: boolean;
  setAccountSettingsOpen: (open: boolean) => void;

  // Command Center
  commandCenterOpen: boolean;
  setCommandCenterOpen: (open: boolean) => void;
  commandCenterView: CommandCenterView;
  setCommandCenterView: (view: CommandCenterView) => void;

  // Canvas
  showCanvasEdges: boolean;
  toggleCanvasEdges: () => void;
}

const UIStoreContext = createContext<UIStoreContextType | undefined>(undefined);

export function useUIStore(props?: {
  commandCenterActiveView?: CommandCenterView;
}) {
  const { commandCenterActiveView } = props ?? {};

  const context = useContext(UIStoreContext);
  if (context === undefined) {
    throw new Error("useUIStore must be used within an UIStoreProvider");
  }

  const { setCommandCenterView } = context;

  useEffect(() => {
    if (commandCenterActiveView) {
      setCommandCenterView(commandCenterActiveView);
    }
  }, [commandCenterActiveView, setCommandCenterView]);

  return context;
}

export function UIStoreProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [authDialogView, setAuthDialogView] = useState<"sign-in" | "sign-up">(
    "sign-in",
  );
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);
  const [commandCenterView, setCommandCenterView] =
    useState<CommandCenterView>("create");
  const [showCanvasEdges, setShowCanvasEdges] = useState(true);
  const [isCanvasInitialized, setIsCanvasInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("flowBuilder.showEdges");
    if (stored !== null) {
      setShowCanvasEdges(stored === "true");
    }
    setIsCanvasInitialized(true);
  }, []);

  const toggleCanvasEdges = () => {
    setShowCanvasEdges((prev) => {
      const newValue = !prev;
      localStorage.setItem("flowBuilder.showEdges", String(newValue));
      return newValue;
    });
  };

  if (!isCanvasInitialized) {
    return null;
  }

  return (
    <UIStoreContext.Provider
      value={{
        // Auth Dialog
        authDialogOpen,
        setAuthDialogOpen,
        authDialogView,
        setAuthDialogView,

        // Account Settings
        accountSettingsOpen,
        setAccountSettingsOpen,

        // Command Center
        commandCenterOpen,
        setCommandCenterOpen,
        commandCenterView,
        setCommandCenterView,

        // Canvas
        showCanvasEdges,
        toggleCanvasEdges,
      }}
    >
      {children}
    </UIStoreContext.Provider>
  );
}
