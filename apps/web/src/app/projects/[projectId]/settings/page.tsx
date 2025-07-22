import { TRPCError } from "@trpc/server";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProjectSettings } from "@/components/project-settings";
import { api } from "@/lib/trpc/server";

import { buttonVariants } from "@weldr/ui/components/button";
import { cn } from "@weldr/ui/lib/utils";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element> {
  try {
    const { projectId } = await params;
    const project = await api.projects.byId({ id: projectId });

    return (
      <div className="flex-1 rounded-md bg-background p-6 py-4">
        <div className="flex flex-col">
          <div className="mb-6">
            <Link
              href={`/projects/${projectId}`}
              className={cn(
                buttonVariants({ variant: "link" }),
                "p-0 text-muted-foreground",
              )}
            >
              <ArrowLeftIcon className="mr-1 size-3" />
              Back
            </Link>
            <h1 className="font-medium text-2xl">{project.title}</h1>
            <p className="text-muted-foreground">Project Settings</p>
          </div>
          <ProjectSettings
            project={project}
            environmentVariables={project.environmentVariables}
          />
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
