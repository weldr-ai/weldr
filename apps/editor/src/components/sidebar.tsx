"use client";

import {
  AppWindowIcon,
  BoltIcon,
  BoxesIcon,
  DatabaseIcon,
  PackageIcon,
  PlusIcon,
  WorkflowIcon,
} from "lucide-react";

import type { RouterOutputs } from "@integramind/api";
import { Button, buttonVariants } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import { ScrollArea } from "@integramind/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import { cn } from "@integramind/ui/utils";
import Link from "next/link";
import { useState } from "react";
import { useCommandCenterStore } from "~/lib/store";
import { api } from "~/lib/trpc/client";
import { AccountDropdownMenu } from "./account-dropdown-menu";
import { CreateEndpointDialog } from "./create-endpoint-dialog";
import { CreateModuleDialog } from "./create-module-dialog";
import { CreateProjectDialog } from "./create-project-dialog";
import { DeleteAlertDialog } from "./delete-alert-dialog";

export function Sidebar({
  project,
  initialModules,
  initialEndpoints,
}: {
  project: RouterOutputs["projects"]["byId"];
  initialModules: RouterOutputs["modules"]["list"];
  initialEndpoints: RouterOutputs["endpoints"]["list"];
}) {
  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
    useState<boolean>(false);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] =
    useState<boolean>(false);

  const { data: modules } = api.modules.list.useQuery(
    {
      projectId: project.id,
    },
    {
      initialData: initialModules,
    },
  );

  const { data: endpoints } = api.endpoints.list.useQuery(
    {
      projectId: project.id,
    },
    {
      initialData: initialEndpoints,
    },
  );

  return (
    <div className="flex flex-col w-14 size-full">
      <div className="flex items-center justify-center h-14 border-b">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <LogoIcon className="size-10" />
              <span className="sr-only">IntegraMind</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" side="right">
            <DropdownMenuItem
              className="flex items-center justify-between text-xs"
              onClick={() => setCommandCenterOpen(true)}
            >
              <div className="flex gap-3">
                <BoxesIcon className="size-4 text-muted-foreground" />
                <span>View All Projects</span>
              </div>
              <span className="text-muted-foreground">cmd+k</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-xs"
              onClick={() => setCreateProjectDialogOpen(true)}
            >
              <PlusIcon className="mr-3 size-4 text-muted-foreground" />
              Create Project
            </DropdownMenuItem>
          </DropdownMenuContent>
          <CreateProjectDialog
            open={createProjectDialogOpen}
            setOpen={setCreateProjectDialogOpen}
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
      <div className="flex flex-col py-2.5 h-[calc(100dvh-56px)] items-center justify-between">
        <div className="flex flex-col items-center space-y-2">
          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <AppWindowIcon className="size-5" />
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>Pages</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              side="right"
              align="start"
              className="bg-muted border w-56"
            >
              <DropdownMenuLabel className="text-xs">Pages</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-48">
                <div className="flex items-center justify-center h-48">
                  <p className="text-xs text-muted-foreground">
                    No pages found
                  </p>
                </div>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <span className="text-[11px] font-bold">API</span>
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>API</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              side="right"
              align="start"
              className="bg-muted border w-56"
            >
              <DropdownMenuLabel className="flex items-center justify-between text-xs p-0.5">
                API Endpoints
                <CreateEndpointDialog size="icon" />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-48">
                {endpoints && endpoints.length > 0 ? (
                  endpoints.map((endpoint) => (
                    <Link
                      key={endpoint.id}
                      href={`/projects/${project.id}/endpoints/${endpoint.id}`}
                    >
                      <DropdownMenuItem className="text-xs">
                        <span
                          className={cn(
                            "text-xs rounded-sm px-1.5 py-0.5 mr-2",
                            {
                              "bg-primary/20 text-primary":
                                endpoint.httpMethod === "get",
                              "bg-success/20 text-success":
                                endpoint.httpMethod === "post",
                              "bg-destructive/20 text-destructive":
                                endpoint.httpMethod === "delete",
                              "bg-warning/20 text-warning":
                                endpoint.httpMethod === "put" ||
                                endpoint.httpMethod === "patch",
                            },
                          )}
                        >
                          {endpoint.httpMethod}
                        </span>
                        {endpoint.name}
                      </DropdownMenuItem>
                    </Link>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-48">
                    <p className="text-xs text-muted-foreground">
                      No API endpoints found
                    </p>
                  </div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <WorkflowIcon className="size-5" />
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>Workflows</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              side="right"
              align="start"
              className="bg-muted border w-56"
            >
              <DropdownMenuLabel className="text-xs">
                Workflows
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-48">
                <div className="flex items-center justify-center h-48">
                  <p className="text-xs text-muted-foreground">
                    No workflows found
                  </p>
                </div>
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <Tooltip>
              <DropdownMenuTrigger asChild>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost">
                    <PackageIcon className="size-5" />
                  </Button>
                </TooltipTrigger>
              </DropdownMenuTrigger>
              <TooltipContent
                side="right"
                className="bg-muted border relative -top-2"
              >
                <p>Modules</p>
              </TooltipContent>
            </Tooltip>
            <DropdownMenuContent
              side="right"
              align="start"
              className="bg-muted border w-56"
            >
              <DropdownMenuLabel className="flex items-center justify-between text-xs p-0.5">
                Modules
                <CreateModuleDialog size="icon" />
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <ScrollArea className="h-48">
                {modules && modules.length > 0 ? (
                  modules.map((module) => (
                    <Link
                      key={module.id}
                      href={`/projects/${project.id}/modules/${module.id}`}
                    >
                      <DropdownMenuItem className="text-xs">
                        {module.name}
                      </DropdownMenuItem>
                    </Link>
                  ))
                ) : (
                  <div className="flex items-center justify-center h-48">
                    <p className="text-xs text-muted-foreground">
                      No modules found
                    </p>
                  </div>
                )}
              </ScrollArea>
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="icon" variant="ghost">
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

          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href={`/projects/${project.id}/settings`}
                className={buttonVariants({ variant: "ghost", size: "icon" })}
              >
                <BoltIcon className="size-5" />
              </Link>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="bg-muted border relative -top-2"
            >
              <p>Settings</p>
            </TooltipContent>
          </Tooltip>
        </div>
        <AccountDropdownMenu />
      </div>
    </div>
  );
}
