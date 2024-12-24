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

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { useCommandCenterStore } from "@/lib/store";
import type { RouterOutputs } from "@integramind/api";

// TODO: the command center should be a complete center to navigate the project quickly
export function CommandCenter({
  projects,
}: { projects: RouterOutputs["projects"]["list"] }) {
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
          placeholder="Search projects..."
        />
        <CommandList className="h-96 w-[500px]">
          <div className="flex items-center justify-between px-3 pt-2">
            <span className="text-muted-foreground text-xs">Projects</span>
            <Button
              className="size-6 rounded-sm bg-muted"
              onClick={() => {
                setCommandCenterOpen(false);
                setCreateProjectDialogOpen(true);
              }}
              variant="outline"
              size="icon"
            >
              <PlusIcon className="size-3 text-muted-foreground" />
            </Button>
          </div>
          <CommandEmpty>No projects found.</CommandEmpty>
          <CommandGroup>
            <div className="grid w-full grid-cols-3 gap-2">
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  className="flex h-24 cursor-pointer flex-col items-center justify-center rounded-lg text-center"
                  onSelect={() => {
                    setCommandCenterOpen(false);
                    router.replace(`/projects/${project.id}`);
                  }}
                >
                  <BoxesIcon className="mb-2 size-24" />
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
