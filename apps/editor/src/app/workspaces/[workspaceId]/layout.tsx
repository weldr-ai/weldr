import type { RouterOutputs } from "@integramind/api";
import type { DbConfig } from "@integramind/shared/integrations/postgres";
import { getDatabaseStructure } from "@integramind/shared/integrations/postgres/helpers";
import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { CommandCenter } from "~/components/command-center";
import { Sidebar } from "~/components/sidebar";
import { ResourcesProvider } from "~/lib/context/resources";
import { api } from "~/lib/trpc/server";

export default async function WorkspacesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}): Promise<JSX.Element> {
  try {
    const { workspaceId } = await params;
    const workspace = await api.workspaces.byId({ id: workspaceId });
    const workspaces = await api.workspaces.list();
    const resources = workspace.resources;

    const resourcesWithMetadata: (RouterOutputs["workspaces"]["byId"]["resources"][0] & {
      metadata: unknown;
    })[] = [];

    for (const resource of resources) {
      const temp = {
        ...resource,
        metadata: {},
      };

      switch (resource.integration.type) {
        case "postgres": {
          const environmentVariables =
            await api.environmentVariables.byResourceId({
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
        <div className="flex h-screen bg-background">
          <div className="sticky top-0 h-screen dark:bg-muted z-50">
            <Sidebar
              workspace={workspace}
              initialModules={workspace.modules}
              initialEndpoints={workspace.endpoints}
            />
          </div>
          <main className="flex-1 dark:bg-muted py-2.5 pr-2.5">
            <div className="h-full rounded-md border overflow-auto bg-background">
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
