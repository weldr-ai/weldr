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
import { cn } from "@weldr/ui/utils";

const versions = [
  {
    value: "v1",
    label: "Version 1",
  },
  {
    value: "v2",
    label: "Version 2",
  },
  {
    value: "v3",
    label: "Version 3",
  },
  {
    value: "v4",
    label: "Version 4",
  },
  {
    value: "v5",
    label: "Version 5",
  },
  {
    value: "v6",
    label: "Version 6",
  },
  {
    value: "v7",
    label: "Version 7",
  },
  {
    value: "v8",
    label: "Version 8",
  },
  {
    value: "v9",
    label: "Version 9",
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
          className="w-[200px] justify-between"
        >
          {value
            ? versions.find((version) => version.value === value)?.label
            : "Select version..."}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput
            className="h-9 border-none text-sm outline-none focus-visible:ring-0"
            placeholder="Search version..."
          />
          <CommandList className="max-h-[200px] overflow-y-auto">
            <CommandEmpty>No version found.</CommandEmpty>
            <CommandGroup className="p-0">
              {versions.map((version) => (
                <CommandItem
                  key={version.value}
                  value={version.value}
                  onSelect={(currentValue) => {
                    setValue(currentValue === value ? "" : currentValue);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      value === version.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {version.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
