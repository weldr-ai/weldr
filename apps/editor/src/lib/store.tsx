"use client";

import {
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

export type CommandCenterView = "create" | "projects";

interface UIStateContextType {
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

  // Project View
  projectView: "preview" | "canvas" | "versions";
  setProjectView: (view: "preview" | "canvas" | "versions") => void;

  // Canvas
  showCanvasEdges: boolean;
  toggleCanvasEdges: () => void;
}

const UIStateContext = createContext<UIStateContextType | undefined>(undefined);

export function useUIState(props?: {
  commandCenterActiveView?: CommandCenterView;
}) {
  const { commandCenterActiveView } = props ?? {};

  const context = useContext(UIStateContext);
  if (context === undefined) {
    throw new Error("useUIState must be used within an UIStateProvider");
  }

  const { setCommandCenterView } = context;

  useEffect(() => {
    if (commandCenterActiveView) {
      setCommandCenterView(commandCenterActiveView);
    }
  }, [commandCenterActiveView, setCommandCenterView]);

  return context;
}

export function UIStateProvider({
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
  const [projectView, setProjectView] = useState<
    "preview" | "canvas" | "versions"
  >("canvas");
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
    <UIStateContext.Provider
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

        // Project View
        projectView,
        setProjectView,

        // Canvas
        showCanvasEdges,
        toggleCanvasEdges,
      }}
    >
      {children}
    </UIStateContext.Provider>
  );
}

interface ProjectDataContextType {
  machineId: string | null;
  setMachineId: (machineId: string | null) => void;
}

const ProjectDataContext = createContext<ProjectDataContextType | undefined>(
  undefined,
);

export function useProjectData() {
  const context = useContext(ProjectDataContext);
  if (context === undefined) {
    throw new Error("useProjectData must be used within a ProjectDataProvider");
  }
  return context;
}

export function ProjectDataProvider({
  initialMachineId,
  children,
}: {
  initialMachineId: string | null;
  children: ReactNode;
}) {
  const [machineId, setMachineId] = useState<string | null>(initialMachineId);

  return (
    <ProjectDataContext.Provider value={{ machineId, setMachineId }}>
      {children}
    </ProjectDataContext.Provider>
  );
}
