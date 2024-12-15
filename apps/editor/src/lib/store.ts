import { create } from "zustand";
import { type PersistOptions, persist } from "zustand/middleware";

interface PrimarySidebarState {
  activeSection:
    | "pages"
    | "database"
    | "endpoints"
    | "workflows"
    | "functions"
    | "modules"
    | null;
}

interface PrimarySidebarAction {
  updateActiveSection: (
    activeSection:
      | "pages"
      | "database"
      | "endpoints"
      | "workflows"
      | "functions"
      | "modules"
      | null,
  ) => void;
}

type PrimarySidebarStore = PrimarySidebarState & PrimarySidebarAction;

const primarySidebarPersist: PersistOptions<PrimarySidebarStore> = {
  name: "primary-sidebar-storage",
};

export const usePrimarySidebarStore = create<PrimarySidebarStore>()(
  persist(
    (set) => ({
      activeSection: "endpoints",
      updateActiveSection: (activeSection) =>
        set(() => ({
          activeSection,
        })),
    }),
    primarySidebarPersist,
  ),
);

interface CommandCenterState {
  open: boolean;
}

interface CommandCenterAction {
  setOpen: (open: boolean) => void;
}

type CommandCenterStore = CommandCenterState & CommandCenterAction;

const commandCenterPersist: PersistOptions<CommandCenterStore> = {
  name: "command-center-storage",
};

export const useCommandCenterStore = create<CommandCenterStore>()(
  persist(
    (set) => ({
      open: false,
      setOpen: (open) => set(() => ({ open })),
    }),
    commandCenterPersist,
  ),
);

interface FlowBuilderState {
  showEdges: boolean;
}

interface FlowBuilderAction {
  toggleEdges: () => void;
}

type FlowBuilderStore = FlowBuilderState & FlowBuilderAction;

const flowBuilderPersist: PersistOptions<FlowBuilderStore> = {
  name: "flow-builder-storage",
};

export const useFlowBuilderStore = create<FlowBuilderStore>()(
  persist(
    (set) => ({
      showEdges: true,
      toggleEdges: () =>
        set((state) => ({
          showEdges: !state.showEdges,
        })),
    }),
    flowBuilderPersist,
  ),
);
