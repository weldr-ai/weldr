"use client";

import { ExternalLinkIcon, PlusIcon } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@integramind/ui/command";

import { CreateProjectDialog } from "@/components/create-project-dialog";
import { useCommandCenter } from "@/lib/store";
import type { RouterOutputs } from "@integramind/api";
import { Button, buttonVariants } from "@integramind/ui/button";
import { LogoIcon } from "@integramind/ui/icons/logo-icon";
import { cn } from "@integramind/ui/utils";
import Link from "next/link";

export function CommandCenter({
  projects,
  asDialog = true,
}: {
  projects: RouterOutputs["projects"]["list"];
  asDialog?: boolean;
}) {
  const { open, setOpen } = useCommandCenter();
  const [createProjectDialogOpen, setCreateProjectDialogOpen] =
    useState<boolean>(false);
  const [selectedProject, setSelectedProject] = useState<
    RouterOutputs["projects"]["list"][0] | null
  >(null);

  useEffect(() => {
    if (!asDialog) return;

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen, asDialog]);

  const content = (
    <div className="flex h-full">
      <div className="w-80 border-r">
        <div className="flex h-full flex-col">
          <CommandInput
            className="border-none focus:ring-0"
            placeholder="Search projects..."
          />
          <CommandList className="h-full overflow-y-auto">
            <CommandEmpty>No projects found.</CommandEmpty>
            <CommandGroup>
              <div className="mt-1 mb-2 flex w-full items-center justify-between pl-1">
                <span className="font-medium text-sm">Projects</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="size-7"
                  onClick={() => setCreateProjectDialogOpen(true)}
                >
                  <PlusIcon className="size-4" />
                </Button>
              </div>
              {projects.map((project) => (
                <CommandItem
                  key={project.id}
                  value={project.name}
                  className="flex cursor-pointer items-center gap-3 rounded-md p-2"
                  onSelect={() => {
                    setSelectedProject(project);
                  }}
                >
                  <div className="flex size-8 items-center justify-center rounded-lg border bg-muted/30">
                    <LogoIcon className="size-6" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium">{project.name}</span>
                    {project.description && (
                      <span className="line-clamp-1 text-muted-foreground text-xs">
                        {project.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6">
        {selectedProject ? (
          <div className="flex h-full flex-col gap-2">
            <Link
              href={`/projects/${selectedProject.id}`}
              className="block overflow-hidden rounded-lg border"
            >
              {selectedProject.thumbnail ? (
                <Image
                  src={selectedProject.thumbnail}
                  alt={selectedProject.name}
                  width={400}
                  height={300}
                  className="rounded-lg object-cover transition-transform duration-200 hover:scale-[1.1]"
                />
              ) : (
                <div className="flex aspect-video h-[250px] w-full items-center justify-center rounded-lg bg-muted/30 transition-transform duration-200 hover:scale-[1.1]">
                  <LogoIcon className="size-24" />
                </div>
              )}
            </Link>

            <div className="flex items-center space-x-2">
              <h2 className="font-semibold text-xl">{selectedProject.name}</h2>
              <Link
                href={`/projects/${selectedProject.id}`}
                className={cn(
                  buttonVariants({
                    variant: "ghost",
                    size: "icon",
                  }),
                  "size-7",
                )}
              >
                <ExternalLinkIcon className="size-3" />
              </Link>
            </div>
            {selectedProject.description && (
              <p className="mt-4 text-muted-foreground">
                {selectedProject.description}
              </p>
            )}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            Select a project to view details
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {asDialog ? (
        <CommandDialog
          open={open}
          onOpenChange={setOpen}
          className="h-[600px] w-[896px] max-w-4xl"
        >
          {content}
        </CommandDialog>
      ) : (
        <Command className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 h-[600px] w-[896px] max-w-4xl rounded-lg border duration-200 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-2 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5 ">
          {content}
        </Command>
      )}
      <CreateProjectDialog
        open={createProjectDialogOpen}
        setOpen={setCreateProjectDialogOpen}
      />
    </>
  );
}
