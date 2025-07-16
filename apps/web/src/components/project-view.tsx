"use client";

import { useQuery } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import { Button, buttonVariants } from "@weldr/ui/components/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@weldr/ui/components/tooltip";
import { cn } from "@weldr/ui/lib/utils";
import type { Edge } from "@xyflow/react";
import { Badge, EyeIcon, GitGraphIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Canvas } from "@/components/canvas";
import { useProject } from "@/lib/context/project";
import { useTRPC } from "@/lib/trpc/react";
import type { CanvasNode } from "@/types";
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
  const router = useRouter();
  const pathname = usePathname();

  const trpc = useTRPC();
  const [sitePreviewDialogOpen, setSitePreviewDialogOpen] = useState(false);
  const { project: contextProject } = useProject();
  const currentVersion = contextProject?.currentVersion;

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
            {!currentVersion?.activatedAt && (
              <>
                <Badge>Not Active</Badge>
                <Button
                  variant="outline"
                  onClick={() => {
                    router.push(pathname);
                  }}
                >
                  View Active
                </Button>
              </>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7 dark:bg-muted"
                  disabled={currentVersion?.status !== "completed"}
                  onClick={() => setSitePreviewDialogOpen(true)}
                >
                  <EyeIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="border bg-background dark:bg-muted">
                <p>View Site</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Link
                  href={`/projects/${project.id}/versions`}
                  className={cn(
                    buttonVariants({
                      variant: "outline",
                      size: "icon",
                    }),
                    "size-7 dark:bg-muted",
                  )}
                >
                  <GitGraphIcon className="size-3.5" />
                </Link>
              </TooltipTrigger>
              <TooltipContent className="border bg-background dark:bg-muted">
                <p>View Version History</p>
              </TooltipContent>
            </Tooltip>
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
