import { create } from "zustand";

import type { BlockData, BlockType } from "~/types";

interface DevelopmentBarState {
  block: {
    type: BlockType;
    data: BlockData;
  } | null;
}

interface DevelopmentBarAction {
  updateActiveBlock: (block: { type: BlockType; data: BlockData }) => void;
  removeActiveBlock: () => void;
}

export const useDevelopmentBarStore = create<
  DevelopmentBarState & DevelopmentBarAction
>((set) => ({
  block: null,
  updateActiveBlock: (block) => set(() => ({ block })),
  removeActiveBlock: () => set(() => ({ block: null })),
}));

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
