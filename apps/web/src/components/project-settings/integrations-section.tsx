"use client";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/react";

import type { RouterOutputs } from "@weldr/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@weldr/ui/components/card";
import { ScrollArea } from "@weldr/ui/components/scroll-area";
import { AddIntegrationDialog } from "../add-integration-dialog";

export function IntegrationsSection({
  projectId,
  integrationTemplates,
  integrations: initialIntegrations,
  environmentVariables,
}: {
  projectId: string;
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
  integrations: RouterOutputs["projects"]["byId"]["integrations"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
}) {
  const trpc = useTRPC();

  const { data: integrations } = useQuery(
    trpc.integrations.list.queryOptions(
      {
        projectId,
      },
      {
        initialData: initialIntegrations,
      },
    ),
  );

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Manage your workspace integrations</CardDescription>
      </CardHeader>
      <CardContent className="h-full">
        <ScrollArea className="h-[calc(100%-65px)]">
          <div className="grid size-full grid-cols-3 gap-4 pb-6">
            {integrationTemplates.map((integrationTemplate) => (
              <AddIntegrationDialog
                key={integrationTemplate.id}
                integrationTemplate={integrationTemplate}
                integration={integrations?.find(
                  (integration) =>
                    integration.integrationTemplate.id ===
                    integrationTemplate.id,
                )}
                environmentVariables={environmentVariables}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
