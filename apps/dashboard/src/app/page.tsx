// import { redirect } from "next/navigation";

// import { auth } from "@integramind/auth";

import { History } from "lucide-react";

import { Button } from "@integramind/ui/button";

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
          <div className="flex h-6 w-full items-center justify-end">
            <Button
              variant="ghost"
              className="flex h-full min-w-20 max-w-min items-center justify-center gap-1 rounded-none text-xs"
            >
              <History className="size-3" />
              Logs
            </Button>
          </div>
        </main>
      </div>
    </div>
  );
}
