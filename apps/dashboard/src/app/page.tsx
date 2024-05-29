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

import { Preview } from "~/components/preview";
import { getProjects } from "~/lib/actions/projects";

export default async function Project(): Promise<JSX.Element> {
  const projects = await getProjects();

  return (
    <div className="flex w-full">
      <CommandDialog open={true}>
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
                  className="flex h-24 flex-col items-center justify-center rounded-xl text-center"
                >
                  <Boxes className="mb-2 size-24" />
                  {project.name}
                </CommandItem>
              ))}
            </div>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <Preview />
    </div>
  );
}
