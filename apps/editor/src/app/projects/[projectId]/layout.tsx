import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { CommandCenter } from "@/components/command-center";
import { ProjectProvider } from "@/lib/store";
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
    // const resourcesWithMetadata = await api.resources.listWithMetadata({
    //   projectId,
    // });

    return (
      <ProjectProvider
        initialProject={{
          id: projectId,
          name: project.name,
          currentVersion: project.versions.find((version) => version.isCurrent),
        }}
      >
        {/* <ResourcesProvider
          resources={resourcesWithMetadata.map((resource) => ({
            id: resource.id,
            name: resource.name,
            integrationType: resource.integration.type,
            metadata: resource.metadata,
          }))}
        > */}

        <main className="flex size-full h-screen ">
          <div className="size-full flex-1 dark:bg-muted">{children}</div>
        </main>

        <CommandCenter projects={projects} />
        {/* </ResourcesProvider> */}
      </ProjectProvider>
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
