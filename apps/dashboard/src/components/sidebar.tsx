"use client";

import {
  BlocksIcon,
  BoxesIcon,
  PlusIcon,
  SidebarCloseIcon,
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

import type { Workspace } from "@specly/shared/types";
import { Avatar, AvatarFallback, AvatarImage } from "@specly/ui/avatar";
import { SpeclyIcon } from "@specly/ui/icons/specly-icon";
import { Tooltip, TooltipContent, TooltipTrigger } from "@specly/ui/tooltip";
import { useState } from "react";
import { signOut } from "~/lib/auth/actions";
import { useCommandCenterStore, usePrimarySidebarStore } from "~/lib/store";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { DeleteAlertDialog } from "./delete-alert-dialog";
import { FlowList } from "./flow-list";
import { ResourceList } from "./resource-list";

export function Sidebar({ workspace }: { workspace: Workspace }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  const activeSection = usePrimarySidebarStore((state) => state.activeSection);
  const updateActiveSection = usePrimarySidebarStore(
    (state) => state.updateActiveSection,
  );

  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
    useState<boolean>(false);
  const [createWorkspaceDialogOpen, setCreateWorkspaceDialogOpen] =
    useState<boolean>(false);

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  return (
    <div className="flex ">
      <div className="flex flex-col w-14 size-full">
        <DropdownMenu>
          <div
            className={cn("flex items-center justify-center h-14 border-b", {
              "border-r": isSidebarOpen,
            })}
          >
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
        <div
          className={cn(
            "flex flex-col py-2.5 h-[calc(100dvh-56px)] items-center justify-between",
            {
              "border-r": isSidebarOpen,
            },
          )}
        >
          <div className="flex flex-col items-center space-y-2">
            <Tooltip>
              <TooltipTrigger>
                <Button
                  className={cn({
                    "bg-accent border": activeSection === "components",
                  })}
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("components");
                  }}
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
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("routes");
                  }}
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
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("workflows");
                  }}
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
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("resources");
                  }}
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
      {isSidebarOpen && (
        <div className="flex flex-col w-[256px]">
          <div className="flex items-center justify-between border-b h-14 px-2.5">
            <Button className="w-full" variant="ghost">
              {workspace.name}
            </Button>
            <Tooltip>
              <TooltipTrigger>
                <Button
                  className="text-muted-foreground hover:bg-transparent"
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    setIsSidebarOpen(false);
                    updateActiveSection(null);
                  }}
                >
                  <SidebarCloseIcon className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-muted border">
                <p>Hide</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {activeSection && (
            <div className="p-2.5">
              {activeSection === "components" ? (
                <div
                  className={cn("w-full", {
                    hidden: activeSection !== "components",
                  })}
                >
                  <FlowList workspaceId={workspace.id} type="component" />
                </div>
              ) : activeSection === "routes" ? (
                <div
                  className={cn("w-full", {
                    hidden: activeSection !== "routes",
                  })}
                >
                  <FlowList workspaceId={workspace.id} type="route" />
                </div>
              ) : activeSection === "workflows" ? (
                <div
                  className={cn("w-full", {
                    hidden: activeSection !== "workflows",
                  })}
                >
                  <FlowList workspaceId={workspace.id} type="workflow" />
                </div>
              ) : (
                <div
                  className={cn("w-full", {
                    hidden: activeSection !== "resources",
                  })}
                >
                  <ResourceList workspaceId={workspace.id} />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
