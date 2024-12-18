import { notFound } from "next/navigation";

import { redirect } from "next/navigation";
import { api } from "~/lib/trpc/server";

import { TRPCError } from "@trpc/server";
import { ProjectSettings } from "~/components/project-settings";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element> {
  try {
    const { projectId } = await params;
    const project = await api.projects.byId({ id: projectId });
    return (
      <div className="flex-1 p-6 bg-background rounded-md">
        <div className="flex flex-col">
          <div className="mb-6">
            <h1 className="text-2xl font-medium">{project.name}</h1>
            <p className="text-muted-foreground">Project Settings</p>
          </div>
          <ProjectSettings project={project} />
        </div>
      </div>
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
