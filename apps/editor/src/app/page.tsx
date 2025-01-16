import { auth } from "@integramind/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CommandCenter } from "@/components/command-center";
import { CreateProjectForm } from "@/components/create-project-form";
import { MainDropdownMenu } from "@/components/main-dropdown-menu";
import { api } from "@/lib/trpc/server";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@integramind/ui/card";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const projects = await api.projects.list();

  return (
    <div className="flex w-full">
      <div className="absolute top-2 left-2 z-[100]">
        <MainDropdownMenu showViewAll={false} />
      </div>
      <div className="fixed inset-0 z-10 flex bg-black/80">
        {projects.length > 0 ? (
          <CommandCenter projects={projects} asDialog={false} />
        ) : (
          <Card className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 max-w-lg rounded-lg border duration-200">
            <CardHeader>
              <CardTitle>Create new project</CardTitle>
              <CardDescription>
                You don't have any projects yet. Please create a new project.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateProjectForm />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
