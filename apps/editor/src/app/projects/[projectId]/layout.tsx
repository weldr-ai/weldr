import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { CommandCenter } from "@/components/command-center";
import { Sidebar } from "@/components/sidebar";
import { ResourcesProvider } from "@/lib/context/resources";
import { api } from "@/lib/trpc/server";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element> {
  try {
    const { projectId } = await params;
    const project = await api.projects.byId({ id: projectId });
    const projects = await api.projects.list();
    const resourcesWithMetadata = await api.resources.listWithMetadata({
      projectId,
    });

    return (
      <ResourcesProvider
        resources={resourcesWithMetadata.map((resource) => ({
          id: resource.id,
          name: resource.name,
          integrationType: resource.integration.type,
          metadata: resource.metadata,
        }))}
      >
        <div className="flex h-screen bg-background">
          <div className="sticky top-0 z-50 h-screen dark:bg-muted">
            <Sidebar
              project={project}
              initialModules={project.modules}
              initialEndpoints={project.endpoints}
            />
          </div>
          <main className="flex-1 py-2.5 pr-2.5 dark:bg-muted">
            <div className="h-full overflow-auto rounded-md border bg-background">
              {children}
            </div>
          </main>
        </div>
        <CommandCenter projects={projects} />
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
