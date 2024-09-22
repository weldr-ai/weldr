"use client";

import {
  BlocksIcon,
  BoxesIcon,
  PlusIcon,
  TrashIcon,
  UnplugIcon,
  WorkflowIcon,
} from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@specly/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@specly/ui/dropdown-menu";
import { cn } from "@specly/ui/utils";

import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
import { SpeclyIcon } from "@specly/ui/icons/specly-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@specly/ui/tooltip";
import { useState } from "react";
import { signOut } from "~/lib/auth/actions";
import { useCommandCenterStore, usePrimarySidebarStore } from "~/lib/store";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { DeleteAlertDialog } from "./delete-alert-dialog";

export function ActivityBar() {
  const { theme, setTheme } = useTheme();
  const activeSection = usePrimarySidebarStore((state) => state.activeSection);
  const updateActiveSection = usePrimarySidebarStore(
    (state) => state.updateActiveSection,
  );
  const { resolvedTheme } = useTheme();
  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
    useState<boolean>(false);
  const [createWorkspaceDialogOpen, setCreateWorkspaceDialogOpen] =
    useState<boolean>(false);

  return (
    <div className="flex flex-col w-14 size-full">
      <DropdownMenu>
        <div className="flex items-center justify-center h-14 border-b">
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <SpeclyIcon
                className="size-5"
                theme={resolvedTheme === "light" ? "light" : "dark"}
              />
              <span className="sr-only">specly</span>
            </Button>
          </DropdownMenuTrigger>
        </div>
        <DropdownMenuContent className="w-56" align="start" side="right">
          <DropdownMenuItem
            className="text-xs"
            onClick={() => setCreateWorkspaceDialogOpen(true)}
          >
            <PlusIcon className="mr-3 size-4 text-muted-foreground" />
            Create Workspace
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center justify-between text-xs"
            onClick={() => setCommandCenterOpen(true)}
          >
            <div className="flex gap-3">
              <BoxesIcon className="size-4 text-muted-foreground" />
              <span>View All Workspaces</span>
            </div>
            <span className="text-muted-foreground">cmd+k</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs text-destructive hover:text-destructive/90 focus:text-destructive/90"
            onClick={() => setDeleteAlertDialogOpen(true)}
          >
            <TrashIcon className="mr-3 size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
        <CreateWorkspaceDialog
          open={createWorkspaceDialogOpen}
          setOpen={setCreateWorkspaceDialogOpen}
        />
        <DeleteAlertDialog
          open={deleteAlertDialogOpen}
          setOpen={setDeleteAlertDialogOpen}
          onDelete={() => {
            return;
          }}
        />
      </DropdownMenu>
      <div className="flex flex-col py-2.5 h-[calc(100dvh-56px)] items-center justify-between">
        <div className="flex flex-col items-center space-y-2">
          <Tooltip>
            <TooltipTrigger>
              <Button
                className={cn({
                  "bg-accent border": activeSection === "components",
                })}
                onClick={() => updateActiveSection("components")}
                size="icon"
                variant="ghost"
              >
                <BlocksIcon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-muted border">
              <p>Components</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                className={cn({
                  "bg-accent border": activeSection === "routes",
                })}
                onClick={() => updateActiveSection("routes")}
                size="icon"
                variant="ghost"
              >
                <span className="text-[10px] font-bold">HTTP</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-muted border">
              <p>Routes</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                className={cn({
                  "bg-accent border": activeSection === "workflows",
                })}
                onClick={() => updateActiveSection("workflows")}
                size="icon"
                variant="ghost"
              >
                <WorkflowIcon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-muted border">
              <p>Workflows</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger>
              <Button
                className={cn({
                  "bg-accent border": activeSection === "resources",
                })}
                onClick={() => updateActiveSection("resources")}
                size="icon"
                variant="ghost"
              >
                <UnplugIcon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="bg-muted border">
              <p>Resources</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="icon" variant="ghost" className="size-8">
              <Avatar className="size-8 rounded-md">
                <AvatarImage src={undefined} alt="User" />
                <AvatarFallback>
                  <div className="size-full bg-gradient-to-br from-rose-500 via-amber-600 to-blue-500" />
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48" align="end" side="right">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Appearance</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    onValueChange={setTheme}
                    value={theme}
                  >
                    <DropdownMenuRadioItem value="light">
                      Light
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="dark">
                      Dark
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="system">
                      System
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut()}>
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
