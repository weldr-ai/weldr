import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";
import { api } from "~/lib/trpc/server";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element> {
  try {
    const { projectId } = await params;
    const project = await api.projects.byId({ id: projectId });
    return (
      <div className="flex size-full">
        <div className="flex size-full flex-col items-center justify-center gap-2 bg-[#F0F0F3] dark:bg-background rounded-md shadow">
          <h1 className="text-2xl font-medium">{project.name}</h1>
          <span className="text-muted-foreground">
            Build • Automate • Accelerate
          </span>
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
