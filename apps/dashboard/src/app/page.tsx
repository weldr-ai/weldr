// import { redirect } from "next/navigation";

// import { auth } from "@integramind/auth";

import { ActivityBar } from "~/components/activity-bar";
import { DevelopmentBar } from "~/components/development-bar";
import { FlowBuilder } from "~/components/flow-builder";
import { Navbar } from "~/components/navbar";
import { PrimarySidebar } from "~/components/primary-sidebar";

export default async function Dashboard(): Promise<JSX.Element> {
  // const session = await auth();
  // if (!session) redirect("/auth/login");
  return (
    <div className="flex size-full min-h-screen flex-col">
      <Navbar />
      <div className="flex w-full flex-row">
        <div className="sticky z-40 flex h-[calc(100dvh-57px)] bg-muted">
          <ActivityBar />
          <PrimarySidebar />
          <DevelopmentBar />
        </div>
        <main className="flex w-full flex-col">
          <FlowBuilder />
        </main>
      </div>
    </div>
  );
}
