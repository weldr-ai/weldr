"use client";

import type { CanvasNode } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@weldr/ui/resizable";

import { Canvas } from "@/components/canvas";
import { api } from "@/lib/trpc/client";
import type { Edge } from "@xyflow/react";
import { Chat } from "./chat";
import { MainDropdownMenu } from "./main-dropdown-menu";
import { ProjectSettings } from "./project-settings";
import { Versions } from "./versions";

export function ProjectView({
  project,
  initialNodes,
  initialEdges,
  // integrations,
}: {
  project: RouterOutputs["projects"]["byId"];
  initialNodes: CanvasNode[];
  initialEdges: Edge[];
  // integrations: RouterOutputs["integrations"]["list"];
}) {
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
          // integrations={integrations}
        />
      </ResizablePanel>
      <ResizableHandle className="w-0" withHandle />
      <ResizablePanel
        className="relative h-full pt-2"
        defaultSize={75}
        minSize={25}
        order={2}
      >
        <div className="absolute top-2 right-0 z-50 flex h-10 items-center gap-1 rounded-bl-lg border-b border-l bg-muted p-1">
          <Versions versions={project.versions} />
          <ProjectSettings project={project} />
        </div>
        <Canvas
          project={project}
          initialNodes={initialNodes}
          initialEdges={initialEdges ?? []}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
