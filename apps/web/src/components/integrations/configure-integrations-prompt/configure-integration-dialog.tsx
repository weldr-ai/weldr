"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState } from "react";

import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/components/dialog";
import { cn } from "@weldr/ui/lib/utils";

import { IntegrationConfigurationFields } from "@/components/integrations/shared";
import { useTRPC } from "@/lib/trpc/react";
import { getIntegrationIcon } from "../shared/utils";

type EnvironmentVariable = RouterOutputs["environmentVariables"]["list"][0];
type IntegrationTemplate = RouterOutputs["integrationTemplates"]["list"][0];

interface ConfigureIntegrationDialogProps {
  integrationTemplate: IntegrationTemplate;
  environmentVariables: EnvironmentVariable[];
  environmentVariableMappings: Record<string, string>;
  onEnvironmentVariableMapping: (configKey: string, envVarId: string) => void;
  isConfigured: boolean;
  disabled?: boolean;
  onConfirm: () => void;
  onCancel?: () => void;
}

export function ConfigureIntegrationDialog({
  integrationTemplate,
  environmentVariables,
  environmentVariableMappings,
  onEnvironmentVariableMapping,
  isConfigured,
  disabled = false,
  onConfirm,
  onCancel,
}: ConfigureIntegrationDialogProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { projectId } = useParams<{ projectId: string }>();
  const project = queryClient.getQueryData(
    trpc.projects.byId.queryKey({ id: projectId }),
  );

  const [dialogOpen, setDialogOpen] = useState(false);

  const requiredVariables = integrationTemplate.variables || [];

  if (!project) {
    return null;
  }

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
        <IntegrationConfigurationFields
          integrationTemplate={integrationTemplate}
          environmentVariables={environmentVariables}
          environmentVariableMappings={environmentVariableMappings}
          onEnvironmentVariableMapping={onEnvironmentVariableMapping}
          projectId={project.id}
        />
        <div className="flex justify-end gap-2">
          {onCancel && (
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
          )}
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
