import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { ProjectView } from "@/components/project-view";
import { api } from "@/lib/trpc/server";
import type { CanvasNode } from "@/types";
import type { Edge } from "@xyflow/react";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { projectId } = await params;
    // const integrations = await api.integrations.list();
    const project = await api.projects.byId({ id: projectId });

    const initialNodes: CanvasNode[] = [];
    const initialEdges: Edge[] = [];

    return (
      <ProjectView
        project={project}
        initialNodes={initialNodes}
        initialEdges={initialEdges ?? []}
        // integrations={integrations}
      />
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
