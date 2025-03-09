"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import * as React from "react";

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

const versions = [
  {
    id: "sdaf123433werafsdzf2",
    number: 1,
    message: "Build a basic to-do list application",
    createdAt: new Date(),
  },
  {
    id: "dsfaf234jkhfgdssfdsy",
    number: 3,
    message: "Integrate a robust database for efficient data storage",
    createdAt: new Date(),
  },
  {
    id: "sadf2rcvbxcvbghfdf13",
    number: 2,
    message: "Implement secure user authentication",
    createdAt: new Date(),
  },
  {
    id: "sdf3445trdfgfdg4asdd",
    number: 4,
    message: "Resolve issues with adding new tasks",
    createdAt: new Date(),
  },
  {
    id: "gfdsdf34asdfag4asdd",
    number: 5,
    message: "Develop a modern, responsive frontend interface",
    createdAt: new Date(),
  },
  {
    id: "vhfsdajfk237asgdfhj",
    number: 7,
    message: "Refine UI details and enhance interactivity",
    createdAt: new Date(),
  },
  {
    id: "fasdf823rhdsfhagsdf",
    number: 8,
    message: "Integrate dynamic UI components",
    createdAt: new Date(),
  },
  {
    id: "afsdfsdf76756sdvcds",
    number: 9,
    message: "Optimize performance and user experience",
    createdAt: new Date(),
  },
];

export function Versions() {
  const [open, setOpen] = React.useState(false);
  const [value, setValue] = React.useState("");

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
            {value
              ? versions.find((version) => version.id === value)?.message
              : "Select version..."}
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
                      setValue(currentValue === value ? "" : currentValue);
                      setOpen(false);
                    }}
                    className="flex min-h-16 items-start justify-start gap-2 rounded-none text-xs"
                  >
                    <Check
                      className={cn(
                        "size-4",
                        value === version.id ? "opacity-100" : "opacity-0",
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
