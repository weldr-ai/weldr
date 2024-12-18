"use client";

import { Button } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import { BoxesIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";
import { useCommandCenterStore } from "~/lib/store";
import { CreateProjectDialog } from "./create-project-dialog";
import { DeleteAlertDialog } from "./delete-alert-dialog";

export function Navbar() {
  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
    useState<boolean>(false);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] =
    useState<boolean>(false);

  return (
    <div className="flex items-center justify-center h-14 border-b">
      <DropdownMenu>
        <div className="flex items-center justify-center size-14 border-r">
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
            onClick={() => setCreateProjectDialogOpen(true)}
          >
            <PlusIcon className="mr-3 size-4 text-muted-foreground" />
            Create Project
          </DropdownMenuItem>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-xs text-destructive hover:text-destructive/90 focus:text-destructive/90"
            onClick={() => setDeleteAlertDialogOpen(true)}
          >
            <TrashIcon className="mr-3 size-4" />
            Delete
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
  );
}
