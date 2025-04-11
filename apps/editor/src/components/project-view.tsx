"use client";

import type { CanvasNode } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@weldr/ui/resizable";

import { Canvas } from "@/components/canvas";
import { useProject } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import type { Edge } from "@xyflow/react";
import { Chat } from "./chat";
import { MainDropdownMenu } from "./main-dropdown-menu";

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
  const { project: projectData } = useProject();

  const { data: project } = api.projects.byId.useQuery(
    {
      id: _project.id,
      currentVersionId: projectData.currentVersion?.id,
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
              {project.name ?? "Unnamed Project"}
            </span>
          </div>
        </div>
        <Chat
          chatId={project.chat.id}
          initialMessages={messages}
          integrationTemplates={integrationTemplates}
        />
      </ResizablePanel>
      <ResizableHandle className="w-0" withHandle />
      <ResizablePanel
        className="h-full pt-2"
        defaultSize={75}
        minSize={25}
        order={2}
      >
        <Canvas
          project={project}
          initialNodes={initialNodes}
          initialEdges={initialEdges ?? []}
          integrationTemplates={integrationTemplates}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
