"use client";

import Image from "next/image";
import {
  Blocks,
  Bot,
  Brain,
  CircleUser,
  CornerDownLeft,
  Cpu,
  Database,
  PanelRightClose,
  PlayCircle,
  Share,
  Split,
  Workflow,
  Zap,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@integramind/ui/button";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

import type { Edge } from "reactflow";
import { Minus, Plus, Scan } from "lucide-react";
import ReactFlow, { Background, MiniMap, Panel } from "reactflow";

import { Card } from "@integramind/ui/card";

import type { Primitive } from "~/types";

const initialPrimitives: Primitive[] = [];

const initEdges: Edge[] = [];

export function Preview() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex size-full min-h-screen flex-col">
      <header className="sticky top-0 flex h-14 items-center gap-4 border-b bg-muted">
        <nav className="flex items-center text-sm">
          <div className="flex size-14 items-center justify-center border-r">
            <Button variant="ghost" size="icon" className="p-0.5">
              {resolvedTheme === "light" ? (
                <Image
                  alt="IntegraMind Logo"
                  height={40}
                  priority
                  src="logo.svg"
                  width={40}
                />
              ) : (
                <Image
                  alt="IntegraMind Logo"
                  height={40}
                  priority
                  src="logo-dark.svg"
                  width={40}
                />
              )}
              <span className="sr-only">IntegraMind</span>
            </Button>
          </div>
        </nav>
        <div className="flex w-full flex-row items-center justify-end gap-2 px-4">
          <Button
            size="sm"
            variant="outline"
            className="flex min-w-20 max-w-min flex-row items-center justify-center gap-1 border border-success text-success hover:bg-success/10 hover:text-success"
          >
            <PlayCircle className="size-3.5" />
            Run
          </Button>
          <Button
            size="sm"
            className="flex min-w-20 max-w-min flex-row items-center justify-center gap-1"
          >
            <Share className="size-3.5" />
            Deploy
          </Button>
        </div>
      </header>
      <div className="flex w-full flex-row">
        <div className="sticky z-40 flex h-[calc(100dvh-56px)] bg-muted">
          <div className="flex w-14 flex-col items-center justify-between border-r p-4">
            <div className="flex flex-col gap-2">
              <Button size="icon" variant="ghost">
                <Blocks className="size-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <span className="text-[10px]">HTTP</span>
              </Button>
              <Button size="icon" variant="ghost">
                <Workflow className="size-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <Database className="size-5" />
              </Button>
            </div>
            <Button size="icon" variant="ghost">
              <CircleUser className="size-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </div>
        </div>
        <main className="flex w-full flex-col">
          <ReactFlow nodes={initialPrimitives} edges={initEdges}>
            <Background
              className="bg-background"
              color="hsl(var(--background))"
            />
            <MiniMap
              className="bottom-11 bg-background"
              position="bottom-left"
              style={{
                height: 100,
                width: 172,
              }}
              nodeColor="hsl(var(--muted-foreground))"
              maskColor="hsl(var(--muted-foreground))"
            />
            <Panel
              position="bottom-left"
              className="flex flex-row rounded-xl border bg-muted"
            >
              <Button
                className="rounded-xl rounded-r-none"
                variant="ghost"
                size="icon"
              >
                <Minus className="size-4" />
              </Button>
              <Button className="w-16 rounded-none" variant="ghost">
                100%
              </Button>
              <Button className="rounded-none" variant="ghost" size="icon">
                <Plus className="size-4" />
              </Button>
              <Button
                className="rounded-xl rounded-l-none"
                variant="ghost"
                size="icon"
              >
                <Scan className="size-4" />
              </Button>
            </Panel>
            <Panel position="top-right">
              <Card className="flex w-80 border-none bg-muted px-6 py-4 shadow-sm">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        Actions
                      </span>
                      <Button
                        className="size-6 rounded-sm bg-muted"
                        variant="outline"
                        size="icon"
                      >
                        <PanelRightClose className="size-3 text-muted-foreground" />
                      </Button>
                    </div>
                    <div className="grid w-full grid-cols-2 gap-2">
                      <div className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab">
                        <Database className="size-4 text-primary" />
                        <span className="w-full text-[10px]">Query</span>
                      </div>
                      <div className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab">
                        <Zap className="size-4 text-primary" />
                        <span className="w-full text-[10px]">Action</span>
                      </div>
                      <div className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab">
                        <Cpu className="size-4 text-primary" />
                        <span className="w-full text-[10px]">
                          Logical Processing
                        </span>
                      </div>
                      <div className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab">
                        <Bot className="size-4 text-primary" />
                        <span className="w-full text-[10px]">
                          AI Processing
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">
                      Controls
                    </span>
                    <div className="grid w-full grid-cols-2 gap-2">
                      <div className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab">
                        <Split className="size-4 text-primary" />
                        <span className="w-full text-[10px]">
                          Logical Branch
                        </span>
                      </div>
                      <div className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab">
                        <Brain className="size-4 text-primary" />
                        <span className="w-full text-[10px]">
                          Semantic Branch
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <span className="text-xs text-muted-foreground">
                      Responses
                    </span>
                    <div className="grid w-full grid-cols-2 gap-2">
                      <div className="flex w-full items-center justify-center gap-2 rounded-lg border bg-accent p-2 text-accent-foreground hover:cursor-grab">
                        <CornerDownLeft className="size-4 text-primary" />
                        <span className="w-full text-[10px]">Response</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            </Panel>
          </ReactFlow>
        </main>
      </div>
    </div>
  );
}
