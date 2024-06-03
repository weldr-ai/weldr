import { create } from "zustand";

interface PrimarySidebarState {
  activeSection:
    | "components"
    | "routes"
    | "workflows"
    | "data-resources"
    | null;
}

interface PrimarySidebarAction {
  updateActiveSection: (
    activeSection: "components" | "routes" | "workflows" | "data-resources",
  ) => void;
  hidePrimaryBar: () => void;
}

export const usePrimarySidebarStore = create<
  PrimarySidebarState & PrimarySidebarAction
>((set) => ({
  activeSection: "components",
  updateActiveSection: (activeSection) =>
    set(() => ({
      activeSection,
    })),
  hidePrimaryBar: () => set(() => ({ activeSection: null })),
}));

interface DevelopmentSheetState {
  currentId: string | null;
}

interface DevelopmentSheetAction {
  updateCurrentId: (id: string) => void;
  removeCurrentId: () => void;
}

export const useDevelopmentSheetStore = create<
  DevelopmentSheetState & DevelopmentSheetAction
>((set) => ({
  currentId: null,
  updateCurrentId: (id) =>
    set(() => ({
      currentId: id,
    })),
  removeCurrentId: () => set(() => ({ currentId: null })),
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
