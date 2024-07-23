"use client";

import {
  BlocksIcon,
  CircleUserIcon,
  DatabaseIcon,
  PlusIcon,
  WorkflowIcon,
} from "lucide-react";

import { Button } from "@integramind/ui/button";

import "reactflow/dist/style.css";
import "~/styles/flow-builder.css";

import { useTheme } from "next-themes";

import { IntegraMind2Icon } from "@integramind/ui/icons/integramind2-icon";

export function Preview() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex size-full min-h-screen flex-row bg-background dark:bg-muted">
      <div className="flex flex-col">
        <header className="flex h-14 items-center border-b bg-muted">
          <nav className="flex items-center text-sm">
            <div className="flex size-14 items-center justify-center border-r p-2">
              <Button variant="ghost" size="icon" className="size-full">
                <IntegraMind2Icon
                  className="size-6"
                  theme={resolvedTheme === "light" ? "light" : "dark"}
                />
                <span className="sr-only">IntegraMind</span>
              </Button>
            </div>
          </nav>
          <div className="flex w-64 items-center justify-center p-2">
            <Button variant="ghost" size="sm" className="w-full">
              IntegraMind
            </Button>
          </div>
        </header>
        <div className="sticky flex h-[calc(100dvh-56px)]">
          <div className="flex h-full w-14 flex-col items-center justify-between border-r p-4">
            <div className="flex flex-col gap-2">
              <Button size="icon" variant="ghost">
                <BlocksIcon className="size-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <span className="text-[10px] font-bold">HTTP</span>
              </Button>
              <Button size="icon" variant="ghost">
                <WorkflowIcon className="size-5" />
              </Button>
              <Button size="icon" variant="ghost">
                <DatabaseIcon className="size-5" />
              </Button>
            </div>

            <Button size="icon" variant="ghost">
              <CircleUserIcon className="size-5" />
              <span className="sr-only">Toggle user menu</span>
            </Button>
          </div>
          <div className="flex w-64 flex-col items-center">
            <div className="flex h-12 w-full items-center justify-between border-b px-4">
              <span className="text-xs">Components</span>
            </div>
            <div className="flex w-full p-2">
              <Button variant="outline" size="sm" className="w-full">
                <PlusIcon className="mr-1.5 size-3.5" />
                Create new component
              </Button>
            </div>
          </div>
        </div>
      </div>
      <main className="flex min-h-full w-full py-2 pr-2">
        <div className="flex size-full flex-col items-center justify-center gap-2 rounded-xl border bg-background">
          <h1 className="text-2xl font-medium">IntegraMind</h1>
          <span className="text-muted-foreground">
            Build • Automate • Accelerate
          </span>
        </div>
      </main>
    </div>
  );
}
