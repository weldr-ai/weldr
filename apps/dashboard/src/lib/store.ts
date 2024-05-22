import { create } from "zustand";

interface PrimarySidebarState {
  activeSection: "blocks" | "routes" | "workflows" | "data-resources" | null;
}

interface PrimarySidebarAction {
  updateActiveSection: (
    activeSection: "blocks" | "routes" | "workflows" | "data-resources",
  ) => void;
  hidePrimaryBar: () => void;
}

export const usePrimarySidebarStore = create<
  PrimarySidebarState & PrimarySidebarAction
>((set) => ({
  activeSection: null,
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
  updateCurrentId: (id: string) =>
    set(() => ({
      currentId: id,
    })),
  removeCurrentId: () => set(() => ({ currentId: null })),
}));
