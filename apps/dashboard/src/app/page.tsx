// import { redirect } from "next/navigation";

// import { auth } from "@integramind/auth";

import { FlowBuilder } from "~/components/flow-builder";
import { Navbar } from "~/components/navbar";
import { Sidebar } from "~/components/sidebar";

export default async function Dashboard(): Promise<JSX.Element> {
  // const session = await auth();
  // if (!session) redirect("/auth/login");

  return (
    <div className="flex size-full min-h-screen flex-col">
      <Navbar />
      <div className="flex w-full flex-row">
        <Sidebar />
        <main className="flex w-full flex-col">
          <FlowBuilder />
        </main>
      </div>
    </div>
  );
}
