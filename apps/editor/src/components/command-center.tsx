"use client";
import { BoxesIcon, ExternalLinkIcon, PlusIcon, TrashIcon } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@weldr/ui/components/command";

import { type CommandCenterView, useCommandCenter } from "@/lib/store";
import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import type { Session } from "@weldr/auth";
import { authClient } from "@weldr/auth/client";
import { Button, buttonVariants } from "@weldr/ui/components/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import { LogoIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import Link from "next/link";
import { CreateProjectForm } from "./create-project-form";
import { DeleteAlertDialog } from "./delete-alert-dialog";

export function CommandCenter({
  projects: _projects,
  asDialog = true,
  view: activeView,
}: {
  projects: RouterOutputs["projects"]["list"];
  asDialog?: boolean;
  view?: CommandCenterView;
}) {
  const { data: session } = authClient.useSession();

  const { open, view, setOpen, setView } = useCommandCenter(activeView);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setView("projects");
        setOpen(true);
      }

      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "p") {
        e.preventDefault();
        setView("create");
        setOpen(true);
      }
    },
    [setOpen, setView],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      document.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [handleKeyDown]);

  return (
    <>
      {asDialog ? (
        <CommandDialog
          open={open}
          onOpenChange={setOpen}
          dialogClassName="min-h-[600px] min-w-[896px] max-w-4xl"
          commandClassName="size-full [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-0"
        >
          <CommandCenterContent
            view={view}
            projects={_projects}
            session={session}
          />
        </CommandDialog>
      ) : (
        <Command className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 h-[600px] w-[896px] max-w-4xl rounded-lg border duration-200 [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-group]]:px-0">
          <CommandCenterContent
            view={view}
            projects={_projects}
            session={session}
          />
        </Command>
      )}
    </>
  );
}

function CommandCenterContent({
  view,
  projects,
  session,
}: {
  view: CommandCenterView;
  projects: RouterOutputs["projects"]["list"];
  session: Session | null;
}) {
  return (
    <div className="flex size-full">
      {view === "projects" ? (
        <ProjectsContent projects={projects} />
      ) : view === "create" ? (
        <CreateContent session={session} />
      ) : null}
    </div>
  );
}

function CreateContent({ session }: { session: Session | null }) {
  const { setView } = useCommandCenter();

  return (
    <div className="relative flex size-full items-center justify-center">
      {session && (
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-3 right-3"
          onClick={() => setView("projects")}
        >
          <BoxesIcon className="mr-2 size-4" />
          View Projects
        </Button>
      )}
      <CreateProjectForm session={session} />
    </div>
  );
}

function ProjectsContent({
  projects: _projects,
}: {
  projects: RouterOutputs["projects"]["list"];
}) {
  const { setView } = useCommandCenter();
  const [deleteProjectOpen, setDeleteProjectOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<
    RouterOutputs["projects"]["list"][0] | null
  >(null);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: projects } = useQuery(
    trpc.projects.list.queryOptions(undefined, {
      initialData: _projects,
    }),
  );

  const deleteProject = useMutation(
    trpc.projects.delete.mutationOptions({
      onSuccess: () => {
        setDeleteProjectOpen(false);
        queryClient.invalidateQueries(trpc.projects.list.queryFilter());
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
    }),
  );

  return (
    <>
      <div className="border-r">
        <CommandInput
          className="border-0 focus:ring-0"
          placeholder="Search projects..."
        />
        <CommandList className="scrollbar-thin scrollbar-thumb-muted-foreground scrollbar-track-muted max-h-[calc(100%-84px)] w-[320px] overflow-y-auto">
          <CommandEmpty>No projects found.</CommandEmpty>
          <CommandGroup className="p-0 [&_[cmdk-group-heading]]:px-0 [&_[cmdk-group-heading]]:py-0">
            {projects.map((project) => (
              <CommandItem
                key={project.id}
                value={project.name ?? "New Project"}
                className={cn("flex items-center gap-3 rounded-none p-2", {
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
            className="absolute bottom-0 w-80 rounded-t-none rounded-br-none rounded-bl-lg border-t bg-background"
            onClick={() => {
              setView("create");
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
                confirmText={selectedProject.name ?? "delete"}
                isPending={deleteProject.isPending}
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
  );
}
