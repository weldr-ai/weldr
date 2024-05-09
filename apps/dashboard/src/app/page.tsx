// import { redirect } from "next/navigation";

// import { auth } from "@integramind/auth";

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
        <main className="flex size-full flex-col gap-4 p-4 md:gap-8 md:p-8"></main>
      </div>
    </div>
  );
}
