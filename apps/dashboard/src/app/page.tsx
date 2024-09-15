import { auth } from "@specly/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@specly/ui/card";
import { redirect } from "next/navigation";

import { CreateWorkspaceForm } from "~/components/create-workspace-form";
import { Preview } from "~/components/preview";
import { WorkspacesDialog } from "~/components/workspaces-dialog";
import { api } from "~/lib/trpc/rsc";

export default async function Home(): Promise<JSX.Element> {
  const session = await auth();

  if (!session?.user) {
    redirect("/auth/sign-in");
  }

  const workspaces = await api.workspaces.getAll();

  return (
    <div className="flex w-full">
      <div className="fixed inset-0 z-50 flex bg-black/80">
        {workspaces.length > 0 ? (
          <WorkspacesDialog workspaces={workspaces} />
        ) : (
          <Card className="fixed left-1/2 top-1/2 z-50 max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-lg border duration-200">
            <CardHeader>
              <CardTitle>Create new workspace</CardTitle>
              <CardDescription>
                {
                  "You don't have any workspaces yet. Please create a new workspace."
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CreateWorkspaceForm />
            </CardContent>
          </Card>
        )}
      </div>
      <Preview />
    </div>
  );
}
