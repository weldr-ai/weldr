"use client";

import {
  BlocksIcon,
  DatabaseIcon,
  PlusIcon,
  SidebarCloseIcon,
  WorkflowIcon,
} from "lucide-react";

import { Button } from "@specly/ui/button";

import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
import { SpeclyIcon } from "@specly/ui/icons/specly-icon";
import { useTheme } from "next-themes";

export function Preview() {
  const { resolvedTheme } = useTheme();

  return (
    <div className="flex size-full min-h-screen flex-row bg-background dark:bg-muted">
      <div className="flex flex-col">
        <header className="flex h-14 items-center border-b bg-muted">
          <nav className="flex items-center text-sm">
            <div className="flex size-14 items-center justify-center border-r p-2">
              <Button variant="ghost" size="icon" className="size-full">
                <SpeclyIcon
                  className="size-6"
                  theme={resolvedTheme === "light" ? "light" : "dark"}
                />
                <span className="sr-only">Specly</span>
              </Button>
            </div>
          </nav>
          <div className="flex w-[256px] items-center justify-center h-14 px-2.5">
            <Button variant="ghost" className="w-full">
              Specly
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:bg-transparent"
            >
              <SidebarCloseIcon className="size-3.5" />
            </Button>
          </div>
        </header>
        <div className="sticky flex h-[calc(100dvh-56px)]">
          <div className="flex h-full w-14 flex-col items-center justify-between border-r py-2.5">
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

            <Button size="icon" variant="ghost" className="size-8">
              <Avatar className="size-8 rounded-md">
                <AvatarImage src={undefined} alt="User" />
                <AvatarFallback>
                  <div className="size-full bg-gradient-to-br from-rose-500 via-amber-600 to-blue-500" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </div>
          <div className="flex w-64 flex-col items-center">
            <div className="flex w-full p-2.5">
              <Button variant="outline" className="w-full">
                <PlusIcon className="mr-1.5 size-3.5" />
                Create new component
              </Button>
            </div>
          </div>
        </div>
      </div>
      <main className="flex min-h-full w-full py-2.5 pr-2.5">
        <div className="flex size-full flex-col items-center justify-center gap-2 rounded-lg border bg-background">
          <h1 className="text-2xl font-medium">Specly</h1>
          <span className="text-muted-foreground">
            Build • Automate • Accelerate
          </span>
        </div>
      </main>
    </div>
  );
}
