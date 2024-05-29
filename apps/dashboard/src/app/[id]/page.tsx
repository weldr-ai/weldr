import { ActivityBar } from "~/components/activity-bar";
import { FlowBuilder } from "~/components/flow-builder";
import { Navbar } from "~/components/navbar";
import { PrimarySidebar } from "~/components/primary-sidebar";

export default async function Project({
  params,
}: {
  params: { id: string };
}): Promise<JSX.Element> {
  console.log(params);
  return (
    <div className="flex size-full min-h-screen flex-col">
      <Navbar />
      <div className="flex w-full flex-row">
        <div className="sticky z-40 flex h-[calc(100dvh-56px)] bg-muted">
          <ActivityBar />
          <PrimarySidebar />
        </div>
        <main className="flex w-full flex-col">
          <FlowBuilder />
        </main>
      </div>
    </div>
  );
}
