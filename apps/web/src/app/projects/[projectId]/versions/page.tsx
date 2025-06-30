import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { VersionsCanvas } from "@/components/versions/canvas";
import { api } from "@/lib/trpc/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<Metadata> {
  const { projectId } = await params;
  const project = await api.projects.byId({ id: projectId });
  return { title: `${project.title ?? "Untitled Project"} - Versions - Weldr` };
}

export default async function VersionsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { projectId } = await params;
    const versions = await api.versions.list({ projectId });

    return (
      <div className="flex h-screen flex-col">
        <div className="flex h-full w-full">
          <VersionsCanvas versions={versions} />
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
