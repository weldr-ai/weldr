"use client";

import { BoltIcon, BoxesIcon, Layers3Icon, PlusIcon } from "lucide-react";

import { useCommandCenterStore } from "@/lib/store";
import type { RouterOutputs } from "@integramind/api";
import { Button, buttonVariants } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";
import Link from "next/link";
import { useState } from "react";
import { AccountDropdownMenu } from "./account-dropdown-menu";
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

  return (
    <div className="flex size-full w-14 flex-col">
      <div className="flex h-14 items-center justify-center border-b">
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
      <div className="flex h-[calc(100dvh-56px)] flex-col items-center justify-between py-2.5">
        <div className="flex flex-col items-center space-y-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon">
                <Layers3Icon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="-top-2 relative border bg-muted"
            >
              <p>Layers</p>
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
              className="-top-2 relative border bg-muted"
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
