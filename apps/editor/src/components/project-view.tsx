"use client";

import type { CanvasNode } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@weldr/ui/resizable";

import { Canvas } from "@/components/canvas";
import { useProjectView } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@weldr/ui/select";
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
  const { selectedView, setSelectedView } = useProjectView();

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
    setSelectedView(initialView);
  }, [searchParams, setSelectedView]);

  useEffect(() => {
    router.push(`${pathname}?${createQueryString("view", selectedView)}`, {
      scroll: false,
    });
  }, [selectedView, router, pathname, createQueryString]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "1":
            e.preventDefault();
            setSelectedView("preview");
            break;
          case "2":
            e.preventDefault();
            setSelectedView("canvas");
            break;
          case "3":
            e.preventDefault();
            setSelectedView("versions");
            break;
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setSelectedView]);

  const { data: project } = api.projects.byId.useQuery(
    {
      id: _project.id,
    },
    {
      initialData: _project,
    },
  );

  const { data: messages } = api.chats.messages.useQuery(
    {
      chatId: project.chat.id,
    },
    {
      initialData: project.chat.messages,
    },
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
          <div className="flex items-center gap-2">
            <Select
              value={selectedView}
              onValueChange={(value) =>
                setSelectedView(value as "preview" | "canvas" | "versions")
              }
            >
              <SelectTrigger className="h-8 w-28 text-xs">
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
          {selectedView === "canvas" && (
            <Canvas
              initialNodes={initialNodes}
              initialEdges={initialEdges ?? []}
            />
          )}
          {selectedView === "preview" && <Preview projectId={project.id} />}
          {selectedView === "versions" && (
            <Versions versions={project.versions} />
          )}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
