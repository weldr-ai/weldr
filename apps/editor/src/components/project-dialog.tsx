"use client";

import { Boxes, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@integramind/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@integramind/ui/command";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { useCommandCenterStore } from "@/lib/store";
import type { RouterOutputs } from "@integramind/api";

export function ProjectsDialog({
  projects,
}: { projects: RouterOutputs["projects"]["list"] }) {
  const router = useRouter();
  const setCommandCenterOpen = useCommandCenterStore((state) => state.setOpen);
  const [createProjectDialogOpen, setCreateProjectDialogOpen] =
    useState<boolean>(false);

  return (
    <>
      <Command className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 h-[350px] max-w-lg rounded-lg border duration-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5">
        <CommandInput
          className="border-none ring-0"
          placeholder="Search projects..."
        />
        <CommandList>
          <CommandEmpty>No projects found.</CommandEmpty>
          <CommandGroup className="py-2">
            <div className="mb-2 flex items-center justify-between">
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
                <Plus className="size-3 text-muted-foreground" />
              </Button>
            </div>
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
                  <Boxes className="mb-2 size-24" />
                  {project.name}
                </CommandItem>
              ))}
            </div>
          </CommandGroup>
        </CommandList>
      </Command>
      <CreateProjectDialog
        open={createProjectDialogOpen}
        setOpen={setCreateProjectDialogOpen}
      />
    </>
  );
}
