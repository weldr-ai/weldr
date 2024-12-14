"use client";

import {
  AppWindowIcon,
  BoxesIcon,
  DatabaseIcon,
  FunctionSquareIcon,
  PlusIcon,
  RefreshCcwIcon,
  SettingsIcon,
  SidebarCloseIcon,
  TrashIcon,
} from "lucide-react";

import type { RouterOutputs } from "@integramind/api";
import { Button, buttonVariants } from "@integramind/ui/button";
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
import Link from "next/link";
import { useState } from "react";
import { useCommandCenterStore, usePrimarySidebarStore } from "~/lib/store";
import { AccountDropdownMenu } from "./account-dropdown-menu";
import { CreateWorkspaceDialog } from "./create-workspace-dialog";
import { DeleteAlertDialog } from "./delete-alert-dialog";

export function Sidebar({
  workspace,
  initialFlows,
}: {
  workspace: RouterOutputs["workspaces"]["byId"];
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

  return (
    <div className="flex ">
      <div className="flex flex-col w-14 size-full">
        <div
          className={cn("flex items-center justify-center h-14 border-b", {
            "border-r": isSidebarOpen,
          })}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon">
                <LogoIcon className="size-10" />
                <span className="sr-only">IntegraMind</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" side="right">
              <DropdownMenuItem className="text-xs">
                <Link
                  href={`/workspaces/${workspace.id}/settings`}
                  className="flex items-center justify-start w-full"
                >
                  <SettingsIcon className="mr-3 size-4 text-muted-foreground" />
                  Workspace Settings
                </Link>
              </DropdownMenuItem>
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
        </div>
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
                    "bg-accent border": activeSection === "pages",
                  })}
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("pages");
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <AppWindowIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>Pages</p>
              </TooltipContent>
            </Tooltip>

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
                  <span className="text-[11px] font-bold">API</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>API</p>
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
                  <RefreshCcwIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>Workflows</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={cn({
                    "bg-accent border": activeSection === "functions",
                  })}
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("functions");
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <FunctionSquareIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>Functions</p>
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  className={cn({
                    "bg-accent border": activeSection === "database",
                  })}
                  onClick={() => {
                    setIsSidebarOpen(true);
                    updateActiveSection("database");
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <DatabaseIcon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>Database</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <AccountDropdownMenu />
        </div>
      </div>
      {isSidebarOpen && (
        <div className="flex flex-col w-[256px]">
          <div className="flex items-center justify-between border-b h-14 px-2.5">
            <Link
              href={`/workspaces/${workspace.id}`}
              className={cn(
                buttonVariants({ variant: "ghost", size: "sm" }),
                "w-full",
              )}
            >
              {workspace.name}
            </Link>
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
              {/* {activeSection === "endpoints" ? (
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
              ) : (
                <></>
              )} */}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
