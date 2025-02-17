"use client";

import { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@weldr/api";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@weldr/ui/tabs";
import { EnvSection } from "./env-section";
import { GeneralSection } from "./general-section";

export function ProjectSettings({
  project,
  // integrations,
}: {
  project: RouterOutputs["projects"]["byId"];
  // integrations: RouterOutputs["integrations"]["list"];
}) {
  const { data: env } = api.environmentVariables.list.useQuery(
    {
      projectId: project.id,
    },
    {
      initialData: project.environmentVariables,
    },
  );

  return (
    <Tabs defaultValue="general" className="flex flex-1 gap-4">
      <TabsList className="flex h-fit w-[230px] flex-col gap-2 p-2.5">
        <TabsTrigger className="w-full justify-start" value="general">
          General
        </TabsTrigger>

        <TabsTrigger className="w-full justify-start" value="integrations">
          Integrations
        </TabsTrigger>
        <TabsTrigger className="w-full justify-start" value="env">
          Environment Variables
        </TabsTrigger>
      </TabsList>

      <div className="flex-1">
        <TabsContent value="general" className="mt-0 space-y-4">
          <GeneralSection project={project} />
        </TabsContent>

        {/* <TabsContent
          value="integrations"
          className="mt-0 h-[calc(100vh-146px)] overflow-hidden"
        >
          <IntegrationsSection project={project} integrations={integrations} />
        </TabsContent> */}

        <TabsContent value="env" className="mt-0">
          <EnvSection env={env} projectId={project.id} />
        </TabsContent>
      </div>
    </Tabs>
  );
}
