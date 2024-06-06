import { notFound } from "next/navigation";

import { ActivityBar } from "~/components/activity-bar";
import { CommandCenter } from "~/components/command-center";
import { Navbar } from "~/components/navbar";
import { PrimarySidebar } from "~/components/primary-sidebar";
import { getWorkspaceById, getWorkspaces } from "~/lib/queries/workspaces";

export default async function WorkspacesLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}): Promise<JSX.Element> {
  const workspace = await getWorkspaceById({ id: params.workspaceId });

  if (!workspace) {
    notFound();
  }

  const workspaces = await getWorkspaces();

  return (
    <>
      <div className="flex size-full min-h-screen flex-row bg-background dark:bg-muted">
        <div className="flex flex-col">
          <Navbar workspace={workspace} />
          <div className="sticky flex h-[calc(100dvh-56px)]">
            <ActivityBar />
            <PrimarySidebar />
          </div>
        </div>
        <main className="flex w-full">{children}</main>
      </div>
      <CommandCenter workspaces={workspaces} />
    </>
  );
}
