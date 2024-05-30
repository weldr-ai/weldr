import { ActivityBar } from "~/components/activity-bar";
import { CommandCenter } from "~/components/command-center";
import { Navbar } from "~/components/navbar";
import { PrimarySidebar } from "~/components/primary-sidebar";
import { getWorkspaces } from "~/lib/actions/workspaces";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<JSX.Element> {
  const workspaces = await getWorkspaces();

  return (
    <>
      <div className="flex size-full min-h-screen flex-col">
        <Navbar />
        <div className="flex w-full flex-row">
          <div className="sticky z-40 flex h-[calc(100dvh-56px)] bg-muted">
            <ActivityBar />
            <PrimarySidebar />
          </div>
          <main className="flex w-full flex-col">
            {children}
            <CommandCenter workspaces={workspaces} />
          </main>
        </div>
      </div>
    </>
  );
}
