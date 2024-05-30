"use client";

import { PanelLeftClose } from "lucide-react";

import { Button } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import { WorkflowsPrimarySidebar } from "~/components/workflows-primary-sidebar";
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
              {activeSection === "compound-blocks"
                ? "Compound Blocks"
                : activeSection === "access-points"
                  ? "Access Points"
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
          <ScrollArea className="w-full">
            {activeSection === "compound-blocks" ? (
              <div
                className={cn(
                  "flex size-full flex-col items-center justify-center",
                  {
                    hidden: activeSection !== "compound-blocks",
                  },
                )}
              >
                <div>Todo</div>
                <div>Blocks</div>
              </div>
            ) : activeSection === "access-points" ? (
              <div
                className={cn(
                  "flex size-full flex-col items-center justify-center",
                  {
                    hidden: activeSection !== "access-points",
                  },
                )}
              >
                <div>Todo</div>
                <div>Access Points</div>
              </div>
            ) : activeSection === "workflows" ? (
              <div
                className={cn("flex w-full p-2", {
                  hidden: activeSection !== "workflows",
                })}
              >
                <WorkflowsPrimarySidebar />
              </div>
            ) : (
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
            )}
          </ScrollArea>
        </div>
      )}
    </>
  );
}
