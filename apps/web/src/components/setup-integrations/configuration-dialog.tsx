"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, PlusIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@weldr/ui/components/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/components/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@weldr/ui/components/popover";
import { cn } from "@weldr/ui/lib/utils";

import { useTRPC } from "@/lib/trpc/react";
import AddEnvironmentVariableDialog from "../add-environment-variable-dialog";
import { getIntegrationIcon } from "./utils";

type EnvironmentVariable = RouterOutputs["environmentVariables"]["list"][0];
type IntegrationTemplate = RouterOutputs["integrationTemplates"]["list"][0];

interface ConfigurationDialogProps {
  integrationTemplate: IntegrationTemplate;
  environmentVariables: EnvironmentVariable[];
  environmentVariableMappings: Record<string, string>;
  onEnvironmentVariableMapping: (configKey: string, envVarId: string) => void;
  isConfigured: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfigurationDialog({
  integrationTemplate,
  environmentVariables,
  environmentVariableMappings,
  onEnvironmentVariableMapping,
  isConfigured,
  disabled = false,
  onConfirm,
  onCancel,
}: ConfigurationDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { projectId } = useParams<{ projectId: string }>();
  const project = queryClient.getQueryData(
    trpc.projects.byId.queryKey({ id: projectId }),
  );

  const [dialogOpen, setDialogOpen] = useState(false);
  const [envVarPopoverStates, setEnvVarPopoverStates] = useState<
    Record<string, boolean>
  >({});

  const requiredVariables = integrationTemplate.variables || [];

  const toggleEnvVarPopover = (variableName: string, isOpen: boolean) => {
    setEnvVarPopoverStates((prev) => ({
      ...prev,
      [variableName]: isOpen,
    }));
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          disabled={disabled}
          className="flex-1 justify-between gap-2 pr-1 focus:ring-0 focus:ring-offset-0"
        >
          <div className="flex min-w-0 items-center gap-2">
            {getIntegrationIcon(integrationTemplate.key, 4)}
            {integrationTemplate.name}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 rounded-sm border bg-background px-1.5 py-0.5",
              "shrink-0 font-medium text-[0.65rem] text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "size-1.5 rounded-full",
                isConfigured ? "bg-success" : "bg-warning",
              )}
            />
            {isConfigured ? "Configured" : "Awaiting Config"}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getIntegrationIcon(integrationTemplate.key, 6)}
            <span>{integrationTemplate.name}</span>
          </DialogTitle>
          <DialogDescription>
            {integrationTemplate.description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          {requiredVariables.map((variable) => (
            <div
              key={variable.name}
              className="grid grid-cols-2 items-center gap-0 gap-y-2 space-y-0 text-xs"
            >
              <div className="flex h-9 items-center rounded-l-md border-y border-l px-3">
                {variable.name}
              </div>
              <div className="flex">
                <Popover
                  open={envVarPopoverStates[variable.name] || false}
                  onOpenChange={(isOpen) =>
                    toggleEnvVarPopover(variable.name, isOpen)
                  }
                >
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-between rounded-l-none text-xs"
                    >
                      {environmentVariableMappings[variable.name]
                        ? environmentVariables.find(
                            (env) =>
                              env.id ===
                              environmentVariableMappings[variable.name],
                          )?.key
                        : "Select environment variable"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[230px] p-0">
                    <Command>
                      <CommandInput
                        className="h-8 text-xs"
                        placeholder="Search environment variables..."
                      />
                      <CommandList className="min-h-[150px] overflow-y-auto">
                        <CommandEmpty className="text-xs">
                          No environment variables found.
                        </CommandEmpty>
                        <CommandGroup>
                          {environmentVariables.map((env) => (
                            <CommandItem
                              key={env.id}
                              value={env.key}
                              onSelect={() => {
                                onEnvironmentVariableMapping(
                                  variable.name,
                                  env.id,
                                );
                                toggleEnvVarPopover(variable.name, false);
                              }}
                              className="text-xs"
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-1.5 size-3.5 opacity-0",
                                  env.id ===
                                    environmentVariableMappings[
                                      variable.name
                                    ] && "opacity-100",
                                )}
                              />
                              {env.key}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    {/** biome-ignore lint/style/noNonNullAssertion: reason */}
                    <AddEnvironmentVariableDialog projectId={project!.id}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start rounded-none rounded-b-md border-x-0 border-b-0 text-xs"
                      >
                        <PlusIcon className="mr-1 size-3.5" />
                        Add new environment
                      </Button>
                    </AddEnvironmentVariableDialog>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              onCancel();
              setDialogOpen(false);
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => {
              onConfirm();
              setDialogOpen(false);
            }}
            disabled={requiredVariables.some(
              (variable) => !environmentVariableMappings[variable.name],
            )}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
