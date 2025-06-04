"use client";

import type { CanvasNode } from "@/types";
import type { RouterOutputs } from "@weldr/api";

import { Canvas } from "@/components/canvas";
import { useUIStore } from "@/lib/store";
import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import type { Edge } from "@xyflow/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { MainDropdownMenu } from "./main-dropdown-menu";
import { ProjectSettings } from "./project-settings";

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
  const searchParams = useSearchParams();
  const { projectView, setProjectView } = useUIStore();

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "preview") {
        params.delete(name);
      } else {
        params.set(name, value);
      }
      return params.toString();
    },
    [searchParams],
  );

  useEffect(() => {
    const initialView =
      (searchParams.get("view") as "preview" | "canvas" | "versions") ??
      "preview";
    setProjectView(initialView);
  }, [searchParams, setProjectView]);

  useEffect(() => {
    router.push(`${pathname}?${createQueryString("view", projectView)}`, {
      scroll: false,
    });
  }, [projectView, router, pathname, createQueryString]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            setProjectView("preview");
            break;
          case "2":
            e.preventDefault();
            setProjectView("canvas");
            break;
          case "3":
            e.preventDefault();
            setProjectView("versions");
            break;
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setProjectView]);

  const trpc = useTRPC();

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

  return (
    <div className="flex size-full flex-col">
      <div className="flex h-10 items-center justify-between border-b px-1">
        <MainDropdownMenu />
        <span className="font-medium text-sm">
          {project.name ?? "Untitled Project"}
        </span>
        <div className="flex items-center gap-1">
          <ProjectSettings
            project={project}
            integrationTemplates={integrationTemplates}
          />
        </div>
      </div>
      <div className="flex size-full">
        <Canvas
          initialNodes={initialNodes}
          initialEdges={initialEdges}
          project={project}
          integrationTemplates={integrationTemplates}
        />
      </div>
    </div>
  );
}
