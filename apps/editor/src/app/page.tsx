import { auth } from "@weldr/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CommandCenter } from "@/components/command-center";
import { MainDropdownMenu } from "@/components/main-dropdown-menu";
import { api } from "@/lib/trpc/server";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const projects = await api.projects.list();

  return (
    <div className="flex w-full">
      <div className="absolute top-2 left-2 z-[100]">
        <MainDropdownMenu />
      </div>
      <div className="fixed inset-0 z-10 flex">
        <CommandCenter projects={projects} asDialog={false} view="create" />
      </div>
    </div>
  );
}
