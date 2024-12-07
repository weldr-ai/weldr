"use client";

import { BoxesIcon, PlusIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@integramind/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@integramind/ui/command";

import type { RouterOutputs } from "@integramind/api";
import { CreateWorkspaceDialog } from "~/components/create-workspace-dialog";
import { useCommandCenterStore } from "~/lib/store";

// TODO: the command center should be a complete center to navigate the workspace quickly
export function CommandCenter({
  workspaces,
}: { workspaces: RouterOutputs["workspaces"]["list"] }) {
  const router = useRouter();
  const commandCenterOpen = useCommandCenterStore((state) => state.open);
  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [createWorkspaceDialogOpen, setCreateWorkspaceDialogOpen] =
    useState<boolean>(false);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandCenterOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setCommandCenterOpen]);

  return (
    <>
      <CommandDialog
        open={commandCenterOpen}
        onOpenChange={setCommandCenterOpen}
      >
        <CommandInput
          className="border-none ring-0"
          placeholder="Search workspaces..."
        />
        <CommandList className="h-96 w-[500px]">
          <div className="flex items-center justify-between pt-2 px-3">
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
              <PlusIcon className="size-3 text-muted-foreground" />
            </Button>
          </div>
          <CommandEmpty>No workspaces found.</CommandEmpty>
          <CommandGroup>
            <div className="grid w-full grid-cols-3 gap-2">
              {workspaces.map((workspace) => (
                <CommandItem
                  key={workspace.id}
                  value={workspace.name}
                  className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg text-center"
                  onSelect={() => {
                    setCommandCenterOpen(false);
                    router.replace(`/workspaces/${workspace.id}`);
                  }}
                >
                  <BoxesIcon className="mb-2 size-24" />
                  {workspace.name}
                </CommandItem>
              ))}
            </div>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <CreateWorkspaceDialog
        open={createWorkspaceDialogOpen}
        setOpen={setCreateWorkspaceDialogOpen}
      />
    </>
  );
}
