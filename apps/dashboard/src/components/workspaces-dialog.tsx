"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Plus } from "lucide-react";

import { Button } from "@integramind/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@integramind/ui/command";

import type { Workspace } from "~/types";
import { CreateWorkspaceDialog } from "~/components/create-workspace-dialog";
import { useCommandCenterStore } from "~/lib/store";

export function WorkspacesDialog({ workspaces }: { workspaces: Workspace[] }) {
  const router = useRouter();
  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [createWorkspaceDialogOpen, setCreateWorkspaceDialogOpen] =
    useState<boolean>(false);

  return (
    <>
      <Command className="fixed left-1/2 top-1/2 z-50 h-[350px] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border duration-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5">
        <CommandInput
          className="border-none ring-0"
          placeholder="Search workspaces..."
        />
        <CommandList>
          <CommandEmpty>No workspaces found.</CommandEmpty>
          <CommandGroup className="py-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Workspaces</span>
              <Button
                className="size-6 rounded-sm bg-muted"
                onClick={() => {
                  setCommandCenterOpen(false);
                  setCreateWorkspaceDialogOpen(true);
                }}
                variant="outline"
                size="icon"
              >
                <Plus className="size-3 text-muted-foreground" />
              </Button>
            </div>
            <div className="grid w-full grid-cols-3 gap-2">
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  value={workspace.name}
                  className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl text-center"
                  onSelect={() => {
                    setCommandCenterOpen(false);
                    router.replace(`/workspaces/${workspace.id}`);
                  }}
                >
                  <Boxes className="mb-2 size-24" />
                  {workspace.name}
                </CommandItem>
              ))}
            </div>
          </CommandGroup>
        </CommandList>
      </Command>
      <CreateWorkspaceDialog
        open={createWorkspaceDialogOpen}
        setOpen={setCreateWorkspaceDialogOpen}
      />
    </>
  );
}
