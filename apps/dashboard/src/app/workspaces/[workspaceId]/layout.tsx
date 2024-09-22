import { notFound } from "next/navigation";

import { CommandCenter } from "~/components/command-center";
import { Sidebar } from "~/components/sidebar";
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
        <div className="flex size-full min-h-screen flex-rows bg-background">
          <div className="sticky flex h-full dark:bg-muted z-50">
            <Sidebar workspace={workspace} />
          </div>
          <main className="flex w-full dark:bg-muted py-2.5 pr-2.5">
            <div className="flex size-full rounded-md border shadow">
              {children}
            </div>
          </main>
        </div>
        <CommandCenter workspaces={workspaces} />
      </>
    );
  } catch (error) {
    notFound();
  }
}
