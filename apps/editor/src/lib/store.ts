import { create } from "zustand";
import { type PersistOptions, persist } from "zustand/middleware";

interface PrimarySidebarState {
  activeSection: "utility" | "endpoints" | "workflows" | "resources" | null;
}

interface PrimarySidebarAction {
  updateActiveSection: (
    activeSection: "utility" | "endpoints" | "workflows" | "resources" | null,
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

interface OnboardingState {
  onboardedFlows: Set<string>;
}

interface OnboardingAction {
  markFlowAsOnboarded: (flowId: string) => void;
}

type OnboardingStore = OnboardingState & OnboardingAction;

const onboardingPersist: PersistOptions<OnboardingStore> = {
  name: "onboarding-storage",
  storage: {
    getItem: (name) => {
      const str = localStorage.getItem(name);
      if (!str) return null;
      const { state } = JSON.parse(str);
      return {
        state: {
          ...state,
          onboardedFlows: new Set(state.onboardedFlows),
        },
      };
    },
    setItem: (name, value) => {
      const { state } = value;
      const serializedValue = {
        state: {
          ...state,
          onboardedFlows: Array.from(state.onboardedFlows),
        },
      };
      localStorage.setItem(name, JSON.stringify(serializedValue));
    },
    removeItem: (name) => localStorage.removeItem(name),
  },
};

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      onboardedFlows: new Set(),
      markFlowAsOnboarded: (flowId) =>
        set((state) => ({
          onboardedFlows: new Set(state.onboardedFlows).add(flowId),
        })),
    }),
    onboardingPersist,
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
