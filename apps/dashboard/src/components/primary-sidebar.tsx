"use client";

import { PanelLeftClose } from "lucide-react";

import { Button } from "@integramind/ui/button";
import { cn } from "@integramind/ui/utils";

import { usePrimarySidebarStore } from "~/lib/store";

export function PrimarySidebar() {
  const activeSection = usePrimarySidebarStore((state) => state.activeSection);
  const hidePrimaryBar = usePrimarySidebarStore(
    (state) => state.hidePrimaryBar,
  );

  return (
    <>
      {activeSection && (
        <div className="flex h-full w-64 flex-col items-center border-r bg-muted">
          <div className="flex w-full items-center justify-between border-b px-4 py-2">
            <span className="text-xs">
              {activeSection === "blocks"
                ? "Blocks"
                : activeSection === "routes"
                  ? "Routes"
                  : activeSection === "workflows"
                    ? "Workflows"
                    : "Data Resources"}
            </span>
            <Button
              className="size-6 rounded-sm bg-muted"
              variant="outline"
              size="icon"
              onClick={hidePrimaryBar}
            >
              <PanelLeftClose className="size-3 text-muted-foreground" />
            </Button>
          </div>
          <div
            className={cn(
              "flex size-full flex-col items-center justify-center",
              {
                hidden: activeSection !== "blocks",
              },
            )}
          >
            <div>Todo</div>
            <div>Blocks</div>
          </div>
          <div
            className={cn(
              "flex size-full flex-col items-center justify-center",
              {
                hidden: activeSection !== "routes",
              },
            )}
          >
            <div>Todo</div>
            <div>Routes</div>
          </div>
          <div
            className={cn(
              "flex size-full flex-col items-center justify-center",
              {
                hidden: activeSection !== "workflows",
              },
            )}
          >
            <div>Todo</div>
            <div>Workflows</div>
          </div>
          <div
            className={cn(
              "flex size-full flex-col items-center justify-center",
              {
                hidden: activeSection !== "data-resources",
              },
            )}
          >
            <div>Todo</div>
            <div>Data Resources</div>
          </div>
        </div>
      )}
    </>
  );
}
