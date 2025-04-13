"use client";

import { toast } from "@weldr/ui/hooks/use-toast";

import { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@weldr/api";
import { useParams } from "next/navigation";
import { AddPostgresIntegrationForm } from "./add-postgres-integration-form";

export function AddIntegrationsForm({
  integrationTemplate,
  integration,
  environmentVariables,
  setDialogOpen,
}: {
  integrationTemplate: RouterOutputs["integrationTemplates"]["byId"];
  integration?: RouterOutputs["projects"]["byId"]["integrations"][number];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  setDialogOpen?: (open: boolean) => void;
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const apiUtils = api.useUtils();

  const addIntegrationMutation = api.integrations.create.useMutation({
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Integration created successfully.",
        duration: 2000,
      });
      setDialogOpen?.(false);
      await apiUtils.integrations.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const updateIntegrationMutation = api.integrations.update.useMutation({
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Integration updated successfully.",
        duration: 2000,
      });
      setDialogOpen?.(false);
      await apiUtils.integrations.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const { data: environmentVariablesOptions } =
    api.environmentVariables.list.useQuery(
      {
        projectId,
      },
      {
        initialData: environmentVariables,
      },
    );

  switch (integrationTemplate.key) {
    case "postgresql": {
      return (
        <AddPostgresIntegrationForm
          postgresIntegration={integrationTemplate}
          addIntegrationMutation={addIntegrationMutation}
          updateIntegrationMutation={updateIntegrationMutation}
          integration={integration}
          environmentVariables={environmentVariablesOptions}
        />
      );
    }
  }
}
