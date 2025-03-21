"use client";

import type { CanvasNode } from "@/types";
import type { RouterOutputs } from "@weldr/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@weldr/ui/resizable";

import { Canvas } from "@/components/canvas";
import { ProjectSettings } from "@/components/project-settings";
import { useProject } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@weldr/ui/tabs";
import type { Edge } from "@xyflow/react";
import { AppWindowIcon, FrameIcon, SettingsIcon } from "lucide-react";
import { Chat } from "./chat";

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
    <ResizablePanelGroup direction="horizontal" className="rounded-xl">
      <ResizablePanel
        defaultSize={25}
        minSize={25}
        order={1}
        className="size-full"
      >
        <Chat
          chatId={project.chat.id}
          initialMessages={messages}
          // integrations={integrations}
        />
      </ResizablePanel>
      <ResizableHandle className="w-0" withHandle />
      <ResizablePanel
        className="h-full border-l"
        defaultSize={75}
        minSize={25}
        order={2}
      >
        <Main
          project={project}
          initialNodes={initialNodes}
          initialEdges={initialEdges ?? []}
          // integrations={integrations}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function Main({
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
  const { project: projectContext } = useProject();

  return (
    <Tabs defaultValue="preview" className="flex size-full flex-col">
      <div className="flex h-12 w-full items-center justify-between border-b px-3">
        <TabsList className="rounded-none border-none p-0">
          <TabsTrigger value="preview">
            <AppWindowIcon className="mr-1 size-4" />
            Preview
          </TabsTrigger>
          <TabsTrigger value="canvas">
            <FrameIcon className="mr-1 size-4" />
            Canvas
          </TabsTrigger>
          <TabsTrigger value="settings">
            <SettingsIcon className="mr-1 size-4" />
            Settings
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="preview" className="mt-0 flex-1 bg-background">
        <div className="flex size-full items-center justify-center">
          {projectContext.currentVersion ? (
            <iframe
              src={`https://${projectContext.currentVersion.machineId}-${project.id}.preview.weldr.app`}
              className="size-full border-none"
              title="Preview"
              sandbox="allow-same-origin allow-scripts allow-forms"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="flex size-full items-center justify-center">
              <p>No version found</p>
            </div>
          )}
        </div>
      </TabsContent>
      <TabsContent value="canvas" className="mt-0 flex-1 bg-background">
        <Canvas
          projectId={project.id}
          initialNodes={initialNodes}
          initialEdges={initialEdges ?? []}
        />
      </TabsContent>
      <TabsContent value="settings" className="mt-0 flex-1 bg-background p-4">
        <ProjectSettings
          project={project}
          // integrations={integrations}
        />
      </TabsContent>
    </Tabs>
  );
}
