"use client";

import { useChat } from "@/lib/store";
import type { RouterOutputs } from "@integramind/api";
import { Button } from "@integramind/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { RocketIcon, SidebarIcon } from "lucide-react";
import { MainDropdownMenu } from "./main-dropdown-menu";

export function Navbar({
  project,
}: {
  project: RouterOutputs["projects"]["byId"];
}) {
  const { toggleCollapsed } = useChat();

  return (
    <div className="flex h-[56px] w-full items-center justify-between px-2">
      <div className="flex items-center gap-2">
        <MainDropdownMenu />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" onClick={toggleCollapsed}>
              <SidebarIcon className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="border bg-muted text-xs">
            Collapse chat
          </TooltipContent>
        </Tooltip>
      </div>

      <h2 className="font-semibold text-sm">{project.name}</h2>

      <div className="flex flex-col items-center space-y-2">
        <Button variant="outline">
          <RocketIcon className="mr-2 size-4 text-primary" />
          Deploy
        </Button>
      </div>
    </div>
  );
}
