"use client";

import { useParams } from "next/navigation";
import { PanelLeftClose } from "lucide-react";

import { Button } from "@integramind/ui/button";
import { cn } from "@integramind/ui/utils";

import { usePrimarySidebarStore } from "~/lib/store";
import { FlowList } from "./flow-list";

export function PrimarySidebar() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const activeSection = usePrimarySidebarStore((state) => state.activeSection);
  const hidePrimaryBar = usePrimarySidebarStore(
    (state) => state.hidePrimaryBar,
  );

  return (
    <>
      {activeSection && (
        <div className="flex w-64 flex-col items-center border-r bg-muted">
          <div className="flex w-full items-center justify-between border-b px-4 py-[7.5px]">
            <span className="text-xs">
              {activeSection === "components"
                ? "Components"
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
          {activeSection === "components" ? (
            <div
              className={cn("flex w-full p-2", {
                hidden: activeSection !== "components",
              })}
            >
              <FlowList workspaceId={workspaceId} type="component" />
            </div>
          ) : activeSection === "routes" ? (
            <div
              className={cn("flex w-full p-2", {
                hidden: activeSection !== "routes",
              })}
            >
              <FlowList workspaceId={workspaceId} type="route" />
            </div>
          ) : activeSection === "workflows" ? (
            <div
              className={cn("flex w-full p-2", {
                hidden: activeSection !== "workflows",
              })}
            >
              <FlowList workspaceId={workspaceId} type="workflow" />
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
        </div>
      )}
    </>
  );
}
