import { Button } from "@specly/ui/button";
import { notFound } from "next/navigation";

import { ActivityBar } from "~/components/activity-bar";
import { CommandCenter } from "~/components/command-center";
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
        <div className="flex size-full min-h-screen flex-rows bg-background">
          <div className="flex-grow border-r dark:bg-muted">
            <ActivityBar />
          </div>
          <div className="flex flex-col size-full">
            <div className="h-14 w-full border-b dark:bg-muted">
              <div className="flex items-center justify-center h-full w-[256px] border-r px-3 py-2.5">
                <Button className="w-full" variant="ghost">
                  {workspace.name}
                </Button>
              </div>
            </div>
            <div className="flex size-full">
              <div className="sticky flex h-[calc(100dvh-56px)] dark:bg-muted">
                <div className="w-[256px] px-3 py-2.5 border-r">
                  <PrimarySidebar />
                </div>
              </div>
              <main className="flex w-full">{children}</main>
            </div>
          </div>
        </div>
        <CommandCenter workspaces={workspaces} />
      </>
    );
  } catch (error) {
    notFound();
  }
}
