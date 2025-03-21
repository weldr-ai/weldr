"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@weldr/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@weldr/ui/popover";
import { ScrollArea } from "@weldr/ui/scroll-area";
import { cn } from "@weldr/ui/utils";
import { useProject } from "../lib/store";
export function Versions({
  versions,
}: {
  versions: RouterOutputs["projects"]["byId"]["versions"];
}) {
  const [open, setOpen] = React.useState(false);
  const { project, setProject } = useProject();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-expanded={open}
          className="w-[256px] justify-between"
        >
          <span className="truncate">
            {project.currentVersion?.message ?? "No versions available"}
          </span>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[256px] p-0">
        <Command>
          <CommandInput
            className="h-9 border-none text-sm outline-none focus-visible:ring-0"
            placeholder="Search version..."
          />
          <CommandList>
            <ScrollArea className="h-[200px]">
              <CommandEmpty>No version found.</CommandEmpty>
              <CommandGroup className="p-0">
                {versions.map((version) => (
                  <CommandItem
                    key={version.id}
                    value={version.id}
                    onSelect={(currentValue) => {
                      setProject({
                        ...project,
                        currentVersion: versions.find(
                          (version) => version.id === currentValue,
                        ),
                      });
                      setOpen(false);
                    }}
                    className="flex min-h-16 items-start justify-start gap-2 rounded-none text-xs"
                  >
                    <Check
                      className={cn(
                        "size-4",
                        project.currentVersion?.id === version.id
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />

                    <span className="text-muted-foreground">
                      #{version.number}
                    </span>

                    <div className="flex flex-col gap-1">
                      <span className="font-medium">{version.message}</span>
                      <span className="text-muted-foreground">
                        {version.createdAt.toLocaleDateString()}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
