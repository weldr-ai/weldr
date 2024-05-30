import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@integramind/ui/card";

import { CreateProjectForm } from "~/components/create-project-form";
import { Preview } from "~/components/preview";
import { ProjectsDialog } from "~/components/projects-dialog";
import { getProjects } from "~/lib/actions/projects";

export default async function Project(): Promise<JSX.Element> {
  const projects = await getProjects();

  return (
    <div className="flex w-full">
      <div id="dialogBackdrop" className="fixed inset-0 z-50 flex bg-black/80">
        {projects.length > 0 ? (
          <ProjectsDialog projects={projects} />
        ) : (
          <Card className="fixed left-1/2 top-1/2 z-50 max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl border duration-200">
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
