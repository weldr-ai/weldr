"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Boxes, Plus } from "lucide-react";

import { Button } from "@integramind/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@integramind/ui/command";

import type { Project } from "~/types";
import { useCommandCenterStore } from "~/lib/store";
import { CreateProjectDialog } from "./create-project-dialog";

export function CommandCenter({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const commandCenterOpen = useCommandCenterStore((state) => state.open);
  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] =
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
          placeholder="Search for a project..."
        />
        <CommandList className="h-96">
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup className="py-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Projects</span>
              <Button
                className="size-6 rounded-sm bg-muted"
                onClick={() => {
                  setCommandCenterOpen(false);
                  setCreateProjectDialogOpen(true);
                }}
                variant="outline"
                size="icon"
              >
                <Plus className="size-3 text-muted-foreground" />
              </Button>
            </div>
            <div className="grid w-full grid-cols-3 gap-2">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-xl text-center"
                  onSelect={() => {
                    setCommandCenterOpen(false);
                    router.replace(`${project.id}`);
                  }}
                >
                  <Boxes className="mb-2 size-24" />
                  {project.name}
                </CommandItem>
              ))}
            </div>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <CreateProjectDialog
        open={createProjectDialogOpen}
        setOpen={setCreateProjectDialogOpen}
      />
    </>
  );
}
