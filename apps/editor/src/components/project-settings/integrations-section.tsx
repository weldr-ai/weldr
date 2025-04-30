"use client";

import { useTRPC } from "@/lib/trpc/react";
import { useQuery } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@weldr/ui/card";
import { ScrollArea } from "@weldr/ui/scroll-area";
import { useMemo } from "react";
import { AddIntegrationDialog } from "../add-integration-dialog";

export function IntegrationsSection({
  projectId,
  integrations: initialIntegrations,
  integrationTemplates,
  environmentVariables,
}: {
  projectId: string;
  integrations: RouterOutputs["projects"]["byId"]["integrations"];
  integrationTemplates: RouterOutputs["integrationTemplates"]["list"];
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

  const mappedIntegrations = useMemo(() => {
    return integrationTemplates.reduce(
      (acc, template) => {
        const integration = integrations.find(
          (integration) => integration.integrationTemplate.id === template.id,
        );

        return Object.assign(acc, {
          [template.key]: {
            integration,
            template,
          },
        });
      },
      {} as Record<
        string,
        {
          integration: RouterOutputs["projects"]["byId"]["integrations"][0];
          template: RouterOutputs["integrationTemplates"]["list"][0];
        }
      >,
    );
  }, [integrations, integrationTemplates]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Integrations</CardTitle>
        <CardDescription>Manage your workspace integrations</CardDescription>
      </CardHeader>
      <CardContent className="h-full">
        <ScrollArea className="h-[calc(100%-65px)]">
          <div className="grid size-full grid-cols-3 gap-4 pb-6">
            {Object.entries(mappedIntegrations).map(([key, integration]) => (
              <AddIntegrationDialog
                key={key}
                integrationTemplate={integration.template}
                integration={integration.integration}
                environmentVariables={environmentVariables}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
