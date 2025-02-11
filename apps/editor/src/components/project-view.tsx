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
import { useView } from "@/lib/store";
import type { ChatMessage } from "@weldr/shared/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@weldr/ui/tabs";
import { cn } from "@weldr/ui/utils";
import { AppWindowIcon, FrameIcon, SettingsIcon } from "lucide-react";
import { Chat } from "./chat";

export function ProjectView({
  project,
  initialNodes,
  initialEdges,
}: {
  project: RouterOutputs["projects"]["byId"];
  initialNodes: CanvasNode[];
  initialEdges: RouterOutputs["versions"]["dependencies"];
}) {
  const { activeTab } = useView();

  return (
    <ResizablePanelGroup direction="horizontal">
      {activeTab !== null && (
        <>
          <ResizablePanel
            defaultSize={25}
            minSize={25}
            order={1}
            className="size-full"
          >
            {activeTab === "chat" ? (
              <Chat
                chatId={project.chatId}
                initialMessages={project.chat as unknown as ChatMessage[]}
              />
            ) : (
              "History"
            )}
          </ResizablePanel>
          <ResizableHandle className="w-0" withHandle />
        </>
      )}
      <ResizablePanel
        className={cn("h-full", {
          "border-l": activeTab !== null,
        })}
        defaultSize={75}
        minSize={25}
        order={2}
      >
        <Main
          project={project}
          initialNodes={initialNodes}
          initialEdges={initialEdges ?? []}
        />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

function Main({
  project,
  initialNodes,
  initialEdges,
}: {
  project: RouterOutputs["projects"]["byId"];
  initialNodes: CanvasNode[];
  initialEdges: RouterOutputs["versions"]["dependencies"];
}) {
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
          Preview
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
        <ProjectSettings project={project} />
      </TabsContent>
    </Tabs>
  );
}
