"use client";
import { BoxesIcon, ExternalLinkIcon, PlusIcon, TrashIcon } from "lucide-react";
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
} from "@weldr/ui/command";

import { useCommandCenter } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@weldr/api";
import { Button, buttonVariants } from "@weldr/ui/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons/logo-icon";
import { cn } from "@weldr/ui/utils";
import Link from "next/link";
import { CreateProjectForm } from "./create-project-form";
import { DeleteAlertDialog } from "./delete-alert-dialog";

export function CommandCenter({
  projects: _projects,
  asDialog = true,
}: {
  projects: RouterOutputs["projects"]["list"];
  asDialog?: boolean;
}) {
  const { open, setOpen } = useCommandCenter();
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<
    RouterOutputs["projects"]["list"][0] | null
  >(null);
  const [isCreateMode, setIsCreateMode] = useState(true);

  const apiUtils = api.useUtils();
  const { data: projects } = api.projects.list.useQuery(undefined, {
    initialData: _projects,
  });

  useEffect(() => {
    if (!asDialog) return;

    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen("view");
      }
      if (e.key === "n" && (e.metaKey || e.ctrlKey) && e.altKey) {
        e.preventDefault();
        setOpen("create");
        setIsCreateMode(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen, asDialog]);

  const deleteProject = api.projects.delete.useMutation({
    onSuccess: () => {
      setDeleteProjectOpen(false);
      apiUtils.projects.list.invalidate();
      toast({
        title: "Project deleted",
        description: "Your project has been deleted",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Failed to delete project",
        description: "Please try again",
      });
    },
  });

  const content = (
    <div className="flex size-full">
      {isCreateMode ? (
        <div className="relative flex size-full items-center justify-center">
          <Button
            variant="ghost"
            size="sm"
            className="absolute top-3 right-3"
            onClick={() => setIsCreateMode(false)}
          >
            <BoxesIcon className="mr-2 size-4" />
            View Projects
          </Button>
          <CreateProjectForm />
        </div>
      ) : (
        <>
          <div className="border-r">
            <CommandInput
              className="focus:ring-0"
              placeholder="Search projects..."
            />
            <CommandList className="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-muted max-h-[calc(100%-84px)] w-[320px] overflow-y-auto">
              <CommandEmpty>No projects found.</CommandEmpty>
              <CommandGroup>
                {projects.map((project) => (
                  <CommandItem
                    key={project.id}
                    value={project.name ?? "New Project"}
                    className={cn("flex items-center gap-3 p-2", {
                      "bg-accent": selectedProject?.id === project.id,
                    })}
                    onSelect={() => {
                      setSelectedProject(project);
                    }}
                  >
                    <div className="flex size-8 items-center justify-center rounded-md border bg-muted/30">
                      <LogoIcon className="size-6" />
                    </div>
                    <span className="font-medium">{project.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              <Button
                variant="ghost"
                className="absolute bottom-0 w-80 rounded-t-none rounded-br-none border-t bg-background"
                onClick={() => {
                  setIsCreateMode(true);
                }}
              >
                <PlusIcon className="mr-2 size-4" />
                Create New Project
              </Button>
            </CommandList>
          </div>
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
                      alt={selectedProject.name ?? "New Project"}
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

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <h2 className="font-semibold text-xl">
                      {selectedProject.name}
                    </h2>
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
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setDeleteProjectOpen(true)}
                  >
                    <TrashIcon className="size-3.5" />
                  </Button>
                  <DeleteAlertDialog
                    open={deleteProjectOpen}
                    setOpen={setDeleteProjectOpen}
                    onDelete={() => {
                      deleteProject.mutate({ id: selectedProject.id });
                    }}
                    confirmText={selectedProject.name ?? "undefined"}
                  />
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Select a project to view details
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {asDialog ? (
        <CommandDialog
          open={open !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setOpen(null);
              setTimeout(() => {
                setIsCreateMode(false);
              }, 300);
            } else {
              setOpen(isCreateMode ? "create" : "view");
            }
          }}
          className="h-[600px] w-[896px] max-w-4xl [&_[cmdk-group]]:px-0"
        >
          {content}
        </CommandDialog>
      ) : (
        <Command className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 h-[600px] w-[896px] max-w-4xl rounded-lg border duration-200 [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-0 [&_[cmdk-input-wrapper]_svg]:size-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:size-5 ">
          {content}
        </Command>
      )}
    </>
  );
}
