"use client";

import { useParams } from "next/navigation";

import { cn } from "@specly/ui/utils";

import { usePrimarySidebarStore } from "~/lib/store";
import { FlowList } from "./flow-list";
import { ResourceList } from "./resource-list";

export function PrimarySidebar() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const activeSection = usePrimarySidebarStore((state) => state.activeSection);

  return (
    <>
      {activeSection && (
        <>
          {activeSection === "components" ? (
            <div
              className={cn("w-full", {
                hidden: activeSection !== "components",
              })}
            >
              <FlowList workspaceId={workspaceId} type="component" />
            </div>
          ) : activeSection === "routes" ? (
            <div
              className={cn("w-full", {
                hidden: activeSection !== "routes",
              })}
            >
              <FlowList workspaceId={workspaceId} type="route" />
            </div>
          ) : activeSection === "workflows" ? (
            <div
              className={cn("w-full", {
                hidden: activeSection !== "workflows",
              })}
            >
              <FlowList workspaceId={workspaceId} type="workflow" />
            </div>
          ) : (
            <div
              className={cn("w-full", {
                hidden: activeSection !== "resources",
              })}
            >
              <ResourceList workspaceId={workspaceId} />
            </div>
          )}
        </>
      )}
    </>
  );
}
