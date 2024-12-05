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

import type { RouterOutputs } from "@integramind/api";
import type { Integration, Workspace } from "@integramind/shared/types";
import { Button } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { cn } from "@integramind/ui/utils";
import { useState } from "react";
import { useCommandCenterStore, usePrimarySidebarStore } from "~/lib/store";
import { api } from "~/lib/trpc/client";
import { AccountDropdownMenu } from "./account-dropdown-menu";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { DeleteAlertDialog } from "./delete-alert-dialog";
import { FlowList } from "./flow-list";
import { ResourceList } from "./resource-list";

export function Sidebar({
  workspace,
  integrations,
  initialResources,
  initialFlows,
}: {
  workspace: Workspace;
  integrations: Omit<Integration, "dependencies">[];
  initialResources: RouterOutputs["resources"]["list"];
  initialFlows: RouterOutputs["flows"]["list"];
}) {
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

  const { data: resources } = api.resources.list.useQuery(
    {
      workspaceId: workspace.id,
    },
    {
      initialData: initialResources,
    },
  );

  const { data: flows } = api.flows.list.useQuery(
    {
      workspaceId: workspace.id,
    },
    {
      initialData: initialFlows as RouterOutputs["flows"]["list"],
    },
  );

  const endpoints = flows.filter((flow) => flow.type === "endpoint");
  const workflows = flows.filter((flow) => flow.type === "workflow");
  const utilities = flows.filter((flow) => flow.type === "utility");

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
                <LogoIcon className="size-10" />
                <span className="sr-only">integramind</span>
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
              <TooltipTrigger asChild>
                <Button
                  className={cn({
                    "bg-accent border": activeSection === "endpoints",
                  })}
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("endpoints");
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <span className="text-[10px] font-bold">HTTP</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-muted border">
                <p>Endpoints</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
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
              <TooltipTrigger asChild>
                <Button
                  className={cn({
                    "bg-accent border": activeSection === "utility",
                  })}
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("utility");
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <BlocksIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right" className="bg-muted border">
                <p>Utilities</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
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
          <AccountDropdownMenu />
        </div>
      </div>
      {isSidebarOpen && (
        <div className="flex flex-col w-[256px]">
          <div className="flex items-center justify-between border-b h-14 px-2.5">
            <Button className="w-full" variant="ghost">
              {workspace.name}
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
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
              {activeSection === "endpoints" ? (
                <div
                  className={cn("w-full", {
                    hidden: activeSection !== "endpoints",
                  })}
                >
                  <FlowList flows={endpoints} type="endpoint" />
                </div>
              ) : activeSection === "workflows" ? (
                <div
                  className={cn("w-full", {
                    hidden: activeSection !== "workflows",
                  })}
                >
                  <FlowList flows={workflows} type="workflow" />
                </div>
              ) : activeSection === "utility" ? (
                <div
                  className={cn("w-full", {
                    hidden: activeSection !== "utility",
                  })}
                >
                  <FlowList flows={utilities} type="utility" />
                </div>
              ) : (
                <div
                  className={cn("w-full", {
                    hidden: activeSection !== "resources",
                  })}
                >
                  <ResourceList
                    integrations={integrations}
                    resources={resources}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
