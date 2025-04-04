"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

import { api } from "@/lib/trpc/client";
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
import { useReactFlow } from "@xyflow/react";
import { useProject } from "../lib/store";

export function Versions({
  versions,
}: {
  versions: RouterOutputs["projects"]["byId"]["versions"];
}) {
  const [open, setOpen] = React.useState(false);
  const { project, setProject } = useProject();
  const apiUtils = api.useUtils();
  const { updateNodeData } = useReactFlow();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          aria-expanded={open}
          className="w-[280px] justify-between bg-muted"
        >
          <div className="space-x-2 truncate">
            <span className="text-muted-foreground">
              {`#${project.currentVersion?.number ?? ""}`}
            </span>
            <span>
              {project.currentVersion?.message ?? "No versions available"}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
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
                    onSelect={async (currentValue) => {
                      setOpen(false);
                      setProject({
                        ...project,
                        currentVersion: versions.find(
                          (version) => version.id === currentValue,
                        ),
                      });

                      updateNodeData("preview", {
                        type: "preview",
                        projectId: project.id,
                        machineId: version.machineId,
                      });

                      await apiUtils.projects.byId.invalidate({
                        id: project.id,
                        currentVersionId: version.id,
                      });
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
                        {version.createdAt.toLocaleTimeString("en-GB", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        ·{" "}
                        {version.createdAt.toLocaleDateString("en-GB", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })}
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
