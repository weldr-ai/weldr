"use client";

import type { CanvasNode } from "@/types";
import type { RouterOutputs } from "@weldr/api";

import { Canvas } from "@/components/canvas";
import { useActiveVersion } from "@/lib/context/active-version";
import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@weldr/ui/components/button";
import type { Edge } from "@xyflow/react";
import { EyeIcon } from "lucide-react";
import { useState } from "react";
import { MainDropdownMenu } from "./main-dropdown-menu";
import { ProjectSettings } from "./project-settings";
import { SitePreviewDialog } from "./site-preview-dialog";

export function ProjectView({
  project: _project,
  initialNodes,
  initialEdges,
  integrationTemplates,
}: {
  project: RouterOutputs["projects"]["byId"];
  initialNodes: CanvasNode[];
  initialEdges: Edge[];
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
}) {
  const trpc = useTRPC();
  const [sitePreviewDialogOpen, setSitePreviewDialogOpen] = useState(false);
  const { activeVersion } = useActiveVersion();

  const { data: project } = useQuery(
    trpc.projects.byId.queryOptions(
      {
        id: _project.id,
      },
      {
        initialData: _project,
      },
    ),
  );

  const { data: env } = useQuery(
    trpc.environmentVariables.list.queryOptions(
      {
        projectId: project.id,
      },
      {
        initialData: project.environmentVariables,
      },
    ),
  );

  return (
    <>
      <div className="flex size-full flex-col">
        <div className="flex h-10 items-center justify-between border-b p-1.5">
          <MainDropdownMenu />
          <span className="font-medium text-sm">
            {project.title ?? "Untitled Project"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7 dark:bg-muted"
              disabled={activeVersion?.status !== "completed"}
              onClick={() => setSitePreviewDialogOpen(true)}
            >
              <EyeIcon className="size-3.5" />
            </Button>
            <ProjectSettings
              project={project}
              integrationTemplates={integrationTemplates}
              environmentVariables={env}
            />
          </div>
        </div>
        <div className="flex size-full">
          <Canvas
            initialNodes={initialNodes}
            initialEdges={initialEdges}
            project={project}
            integrationTemplates={integrationTemplates}
            environmentVariables={env}
          />
        </div>
      </div>
      <SitePreviewDialog
        open={sitePreviewDialogOpen}
        onOpenChange={setSitePreviewDialogOpen}
        title={project.title ?? "Untitled Project"}
      />
    </>
  );
}
