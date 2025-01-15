"use client";

import { useChat, useCommandCenter } from "@/lib/store";
import type { RouterOutputs } from "@integramind/api";
import { Button } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import {
  BookOpenIcon,
  BoxesIcon,
  CreditCardIcon,
  ExternalLinkIcon,
  HelpCircleIcon,
  LogOutIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
  SidebarIcon,
} from "lucide-react";
import { useState } from "react";
import { CreateProjectDialog } from "./create-project-dialog";

export function Navbar({
  project,
}: {
  project: RouterOutputs["projects"]["byId"];
}) {
  const [createProjectDialogOpen, setCreateProjectDialogOpen] = useState(false);
  const { setOpen } = useCommandCenter();
  const { toggleCollapsed } = useChat();

  return (
    <div className="flex h-[56px] w-full items-center justify-between px-2">
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <LogoIcon className="size-10" />
              <span className="sr-only">IntegraMind</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="bottom">
            <DropdownMenuLabel>Projects</DropdownMenuLabel>
            <DropdownMenuItem onClick={() => setCreateProjectDialogOpen(true)}>
              <PlusIcon className="mr-2 size-4 text-muted-foreground" />
              Create Project
            </DropdownMenuItem>
            <DropdownMenuItem
              className="flex items-center justify-between"
              onClick={() => setOpen(true)}
            >
              <BoxesIcon className="mr-2 size-4 text-muted-foreground" />
              <span>View All Projects</span>
              <span className="ml-auto text-muted-foreground text-xs">
                cmd+k
              </span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Account</DropdownMenuLabel>
            <DropdownMenuItem>
              <SettingsIcon className="mr-2 size-4 text-muted-foreground" />
              Account Settings
            </DropdownMenuItem>
            <DropdownMenuItem>
              <CreditCardIcon className="mr-2 size-4 text-muted-foreground" />
              Billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Support</DropdownMenuLabel>
            <DropdownMenuItem>
              <HelpCircleIcon className="mr-2 size-4 text-muted-foreground" />
              Help
              <ExternalLinkIcon className="ml-auto size-3 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BookOpenIcon className="mr-2 size-4 text-muted-foreground" />
              Docs
              <ExternalLinkIcon className="ml-auto size-3 text-muted-foreground" />
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOutIcon className="mr-2 size-4 text-muted-foreground" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
          <CreateProjectDialog
            open={createProjectDialogOpen}
            setOpen={setCreateProjectDialogOpen}
          />
        </DropdownMenu>
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
