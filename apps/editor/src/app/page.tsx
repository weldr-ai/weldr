import { AccountDropdownMenu } from "@/components/account-dropdown-menu";
import { auth } from "@integramind/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@integramind/ui/card";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { CreateProjectForm } from "@/components/create-project-form";
import { Preview } from "@/components/preview";
import { ProjectsDialog } from "@/components/project-dialog";
import { api } from "@/lib/trpc/server";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/auth/sign-in");
  }

  const projects = await api.projects.list();

  return (
    <div className="flex w-full">
      <div className="absolute bottom-1 left-3 z-50">
        <AccountDropdownMenu />
      </div>
      <div className="fixed inset-0 z-10 flex bg-black/80">
        {projects.length > 0 ? (
          <ProjectsDialog projects={projects} />
        ) : (
          <Card className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-50 max-w-lg rounded-lg border duration-200">
            <CardHeader>
              <CardTitle>Create new project</CardTitle>
              <CardDescription>
                {
                  "You don't have any projects yet. Please create a new project."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateProjectForm />
            </CardContent>
          </Card>
        )}
      </div>
      <Preview />
    </div>
  );
}
