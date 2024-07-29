"use client";

import { BoxesIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useState } from "react";

import { Button } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";

import type { Workspace } from "@integramind/shared/types";
import { IntegraMind2Icon } from "@integramind/ui/icons/integramind2-icon";
import { CreateWorkspaceDialog } from "~/components/create-workspace-dialog";
import { DeleteAlertDialog } from "~/components/delete-alert-dialog";
import { useCommandCenterStore } from "~/lib/store";

export function Navbar({ workspace }: { workspace: Workspace }): JSX.Element {
  const { resolvedTheme } = useTheme();
  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [deleteAlertDialogOpen, setDeleteAlertDialogOpen] =
    useState<boolean>(false);
  const [createWorkspaceDialogOpen, setCreateWorkspaceDialogOpen] =
    useState<boolean>(false);

  return (
    <header className="flex h-14 items-center border-b">
      <nav className="flex items-center text-sm">
        <DropdownMenu>
          <div className="flex size-14 items-center justify-center border-r p-2">
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-full">
                <IntegraMind2Icon
                  className="size-6"
                  theme={resolvedTheme === "light" ? "light" : "dark"}
                />
                <span className="sr-only">IntegraMind</span>
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
        </DropdownMenu>
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
      </nav>
      <div className="flex w-64 items-center justify-center p-2">
        <Button variant="ghost" className="size-full">
          {workspace.name}
        </Button>
      </div>
    </header>
  );
}
