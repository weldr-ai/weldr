"use client";

import { useParams } from "next/navigation";

import { cn } from "@integramind/ui/utils";

import { usePrimarySidebarStore } from "~/lib/store";
import { FlowList } from "./flow-list";

export function PrimarySidebar() {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const activeSection = usePrimarySidebarStore((state) => state.activeSection);

  return (
    <>
      {activeSection && (
        <div className="flex w-64 flex-col items-center">
          <div className="flex h-12 w-full items-center justify-between border-b px-4">
            <span className="text-xs">
              {activeSection === "components"
                ? "Components"
                : activeSection === "routes"
                  ? "Routes"
                  : activeSection === "workflows"
                    ? "Workflows"
                    : "Data Resources"}
            </span>
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
