import { create } from "zustand";

interface PrimarySidebarState {
  activeSection: "components" | "routes" | "workflows" | "resources" | null;
}

interface PrimarySidebarAction {
  updateActiveSection: (
    activeSection: "components" | "routes" | "workflows" | "resources" | null,
  ) => void;
}

export const usePrimarySidebarStore = create<
  PrimarySidebarState & PrimarySidebarAction
>((set) => ({
  activeSection: "components",
  updateActiveSection: (activeSection) =>
    set(() => ({
      activeSection,
    })),
}));

interface CommandCenterState {
  open: boolean;
}

interface CommandCenterAction {
  setOpen: (open: boolean) => void;
}

export const useCommandCenterStore = create<
  CommandCenterState & CommandCenterAction
>((set) => ({
  open: false,
  setOpen: (open) => set(() => ({ open })),
}));
