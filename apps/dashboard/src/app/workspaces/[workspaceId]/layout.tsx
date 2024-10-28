import type { DbConfig } from "@specly/shared/integrations/postgres";
import { getDatabaseStructure } from "@specly/shared/integrations/postgres/helpers";
import type { Resource } from "@specly/shared/types";
import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { CommandCenter } from "~/components/command-center";
import { Sidebar } from "~/components/sidebar";
import { ResourcesProvider } from "~/lib/context/resources";
import { api } from "~/lib/trpc/rsc";

export default async function WorkspacesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}): Promise<JSX.Element> {
  try {
    const workspace = await api.workspaces.getById({ id: params.workspaceId });
    const workspaces = await api.workspaces.getAll();
    const flows = await api.flows.getAll({ workspaceId: params.workspaceId });
    const integrations = await api.integrations.getAll();
    const resources = await api.resources.getAll({
      workspaceId: params.workspaceId,
    });

    const resourcesWithMetadata: (Resource & {
      metadata: unknown;
    })[] = [];

    for (const resource of resources) {
      const temp: Resource & { metadata: unknown } = {
        ...resource,
        metadata: {},
      };

      switch (resource.integration.type) {
        case "postgres": {
          const environmentVariables =
            await api.environmentVariables.getByResourceId({
              resourceId: resource.id,
            });

          const config = environmentVariables.reduce(
            (acc: DbConfig, { key, value }: { key: string; value: string }) => {
              const mapping: Record<string, keyof typeof acc> = {
                POSTGRES_HOST: "host",
                POSTGRES_PORT: "port",
                POSTGRES_DB: "database",
                POSTGRES_USER: "user",
                POSTGRES_PASSWORD: "password",
              };
              // @ts-ignore
              acc[mapping[key]] = value;
              return acc;
            },
            {} as DbConfig,
          );

          const databaseStructure = await getDatabaseStructure(config);
          temp.metadata = databaseStructure;
          break;
        }
      }

      resourcesWithMetadata.push(temp);
    }

    return (
      <ResourcesProvider resources={resourcesWithMetadata}>
        <div className="flex size-full min-h-screen flex-rows bg-background">
          <div className="sticky flex h-full dark:bg-muted z-50">
            <Sidebar
              workspace={workspace}
              integrations={integrations}
              resources={resources}
              flows={flows}
            />
          </div>
          <main className="flex w-full dark:bg-muted py-2.5 pr-2.5">
            <div className="flex size-full rounded-md border shadow">
              {children}
            </div>
          </main>
        </div>
        <CommandCenter workspaces={workspaces} />
      </ResourcesProvider>
    );
  } catch (error) {
    console.error(error);
    if (error instanceof TRPCError) {
      switch (error.code) {
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: notFound function already returns
        case "NOT_FOUND":
          notFound();
        case "UNAUTHORIZED":
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: redirect function already returns
        case "FORBIDDEN":
          redirect("/auth/sign-in");
        default:
          return <div>Error</div>;
      }
    }
    return <div>Error</div>;
  }
}
