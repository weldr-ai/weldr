import { notFound } from "next/navigation";

import { ActivityBar } from "~/components/activity-bar";
import { CommandCenter } from "~/components/command-center";
import { Navbar } from "~/components/navbar";
import { PrimarySidebar } from "~/components/primary-sidebar";
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
  } catch (error) {
    notFound();
  }
}
