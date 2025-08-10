"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";

import type { RouterOutputs } from "@weldr/api";

import { useTRPC } from "@/lib/trpc/react";
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

  const trpc = useTRPC();

  const { data: environmentVariablesOptions } = useQuery(
    trpc.environmentVariables.list.queryOptions(
      {
        projectId,
      },
      {
        initialData: environmentVariables,
      },
    ),
  );

  switch (integrationTemplate.key) {
    case "postgresql": {
      return (
        <AddPostgresIntegrationForm
          postgresIntegration={integrationTemplate}
          setDialogOpen={setDialogOpen}
          integration={integration}
          environmentVariables={environmentVariablesOptions}
        />
      );
    }
  }
}
