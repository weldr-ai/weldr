"use client";

import { Editor } from "@/components/editor";
import { useChat } from "@/lib/store";
import type { CanvasNode } from "@/types";
import type { RouterOutputs } from "@integramind/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@integramind/ui/resizable";
import { ScrollArea } from "@integramind/ui/scroll-area";

import { Canvas } from "@/components/canvas";
import { ProjectSettings } from "@/components/project-settings";
import { Button } from "@integramind/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@integramind/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import {
  AppWindowIcon,
  ExternalLinkIcon,
  FrameIcon,
  SettingsIcon,
} from "lucide-react";

export function ProjectView({
  project,
  initialNodes,
  initialEdges,
}: {
  project: RouterOutputs["projects"]["byId"];
  initialNodes: CanvasNode[];
  initialEdges: RouterOutputs["versions"]["dependencies"];
}) {
  const { isCollapsed } = useChat();

  return (
    <ResizablePanelGroup direction="horizontal" className="space-x-0.5">
      {!isCollapsed && (
        <>
          <ResizablePanel defaultSize={30} minSize={30} order={1}>
            <Tabs
              defaultValue="chat"
              className="flex h-full flex-col overflow-hidden rounded-lg border"
            >
              <div className="flex w-full items-center justify-between border-b px-3 py-1.5">
                <TabsList className="rounded-none border-none p-0">
                  <TabsTrigger value="chat">Chat</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
              </div>
              <TabsContent value="chat">
                <ScrollArea className="h-[calc(100vh-238px)] px-2">
                  <div />
                </ScrollArea>
                <div className="p-2">
                  <Editor id="editor" className="h-full" />
                </div>
              </TabsContent>
              <TabsContent value="history">
                <ScrollArea className="h-[calc(100vh-132px)] px-2">
                  <div />
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </ResizablePanel>
          <ResizableHandle className="bg-primary opacity-0 hover:opacity-100" />
        </>
      )}
      <ResizablePanel
        className="h-full rounded-md border"
        defaultSize={70}
        minSize={30}
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
      <div className="flex w-full items-center justify-between border-b px-3 py-1.5">
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
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="size-7">
              <ExternalLinkIcon className="size-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border bg-muted text-xs">
            Open in new tab
          </TooltipContent>
        </Tooltip>
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
