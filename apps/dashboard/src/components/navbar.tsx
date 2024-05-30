"use client";

import { useState } from "react";
import Image from "next/image";
import { Boxes, PlayCircle, Plus, Share, Trash } from "lucide-react";
import { useTheme } from "next-themes";

import { Button } from "@integramind/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@integramind/ui/dropdown-menu";

import type { Workspace } from "~/types";
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
    <header className="sticky top-0 flex h-14 items-center gap-4 border-b bg-muted">
      <div className="flex">
        <nav className="flex items-center text-sm">
          <DropdownMenu>
            <div className="flex size-14 items-center justify-center border-r">
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="p-0.5">
                  {resolvedTheme === "light" ? (
                    <Image
                      alt="IntegraMind Logo"
                      height={40}
                      priority
                      src="/logo.svg"
                      width={40}
                    />
                  ) : (
                    <Image
                      alt="IntegraMind Logo"
                      height={40}
                      priority
                      src="/logo-dark.svg"
                      width={40}
                    />
                  )}
                  <span className="sr-only">IntegraMind</span>
                </Button>
              </DropdownMenuTrigger>
            </div>
            <DropdownMenuContent className="w-56" align="start" side="right">
              <DropdownMenuItem
                className="text-xs"
                onClick={() => setCreateWorkspaceDialogOpen(true)}
              >
                <Plus className="mr-3 size-4 text-muted-foreground" />
                Create Workspace
              </DropdownMenuItem>
              <DropdownMenuItem
                className="flex items-center justify-between text-xs"
                onClick={() => setCommandCenterOpen(true)}
              >
                <div className="flex gap-3">
                  <Boxes className="size-4 text-muted-foreground" />
                  <span>View All Workspaces</span>
                </div>
                <span className="text-muted-foreground">cmd+k</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-xs text-destructive hover:text-destructive/90 focus:text-destructive/90"
                onClick={() => setDeleteAlertDialogOpen(true)}
              >
                <Trash className="mr-3 size-4" />
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
        <div className="flex w-64 items-center justify-center border-r p-2">
          <Button variant="ghost" className="size-full">
            {workspace.name}
          </Button>
        </div>
      </div>
      <div className="flex w-full flex-row items-center justify-end gap-2 px-4">
        <Button
          size="sm"
          variant="outline"
          className="flex min-w-20 max-w-min flex-row items-center justify-center gap-1 border border-success text-success hover:bg-success/10 hover:text-success"
        >
          <PlayCircle className="size-3.5" />
          Run
        </Button>
        <Button
          size="sm"
          className="flex min-w-20 max-w-min flex-row items-center justify-center gap-1"
        >
          <Share className="size-3.5" />
          Deploy
        </Button>
      </div>
    </header>
  );
}
