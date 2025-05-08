"use client";

import type { CanvasNode } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@weldr/ui/components/resizable";

import { Canvas } from "@/components/canvas";
import { useUIState } from "@/lib/store";
import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@weldr/ui/components/select";
import type { Edge } from "@xyflow/react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect } from "react";
import { Preview } from "./canvas/nodes/preview";
import { Chat } from "./chat";
import { MainDropdownMenu } from "./main-dropdown-menu";
import { ProjectSettings } from "./project-settings";
import { Versions } from "./versions";

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
  const { projectView, setProjectView } = useUIState();

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

  const { data: messages } = useQuery(
    trpc.chats.messages.queryOptions(
      {
        chatId: project.chat.id,
      },
      {
        initialData: project.chat.messages,
      },
    ),
  );

  return (
    <ResizablePanelGroup direction="horizontal">
      <ResizablePanel
        defaultSize={25}
        minSize={25}
        order={1}
        className="size-full"
      >
        <div className="flex h-12 items-center justify-between border-b px-2">
          <div className="flex items-center gap-2">
            <MainDropdownMenu />
            <span className="font-medium text-sm">
              {project.name ?? "Untitled Project"}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Select
              value={projectView}
              onValueChange={(value) =>
                setProjectView(value as "preview" | "canvas" | "versions")
              }
            >
              <SelectTrigger className="max-h-8 w-28 text-xs dark:bg-muted">
                <SelectValue placeholder="Select a view" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem className="text-xs" value="preview">
                  Preview
                </SelectItem>
                <SelectItem className="text-xs" value="canvas">
                  Canvas
                </SelectItem>
                <SelectItem className="text-xs" value="versions">
                  Versions
                </SelectItem>
              </SelectContent>
            </Select>
            <ProjectSettings
              project={project}
              integrationTemplates={integrationTemplates}
            />
          </div>
        </div>
        <Chat
          chatId={project.chat.id}
          initialMessages={messages}
          integrationTemplates={integrationTemplates}
          project={project}
        />
      </ResizablePanel>
      <ResizableHandle className="w-0" withHandle />
      <ResizablePanel
        className="h-full py-2 pr-2"
        defaultSize={75}
        minSize={25}
        order={2}
      >
        <div className="flex size-full rounded-xl">
          {projectView === "canvas" && (
            <Canvas
              initialNodes={initialNodes}
              initialEdges={initialEdges ?? []}
            />
          )}
          {projectView === "preview" && <Preview projectId={project.id} />}
          {projectView === "versions" && (
            <Versions versions={project.versions} />
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
