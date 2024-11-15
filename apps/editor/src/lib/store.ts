import { create } from "zustand";

interface PrimarySidebarState {
  activeSection: "utilities" | "endpoints" | "tasks" | "resources" | null;
}

interface PrimarySidebarAction {
  updateActiveSection: (
    activeSection: "utilities" | "endpoints" | "tasks" | "resources" | null,
  ) => void;
}

export const usePrimarySidebarStore = create<
  PrimarySidebarState & PrimarySidebarAction
>((set) => ({
  activeSection: "endpoints",
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
