import Link from "next/link";
import { Boxes } from "lucide-react";

import { buttonVariants } from "@integramind/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@integramind/ui/card";
import { cn } from "@integramind/ui/utils";

import { CreateProjectForm } from "~/components/create-project-form";
import { Preview } from "~/components/preview";
import { getProjects } from "~/lib/actions/projects";

export default async function Project(): Promise<JSX.Element> {
  const projects = await getProjects();

  return (
    <div className="flex w-full">
      <div
        id="dialogBackdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      >
        <Card>
          <CardHeader>
            <CardTitle>
              {projects.length > 0 ? (
                <>{"Choose a Project"}</>
              ) : (
                <>{"Create a project"}</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex w-[500px]">
            {projects.length > 0 ? (
              <div className="grid h-96 w-full grid-cols-3 gap-2 overflow-y-auto">
                {projects.map((project) => (
                  <Link
                    href={`/${project.id}`}
                    key={project.id}
                    className={cn(
                      buttonVariants({ variant: "ghost" }),
                      "flex h-24 w-full flex-col items-center justify-center rounded-xl text-center",
                    )}
                  >
                    <Boxes className="mb-2 size-6 stroke-1" />
                    {project.name}
                  </Link>
                ))}
              </div>
            ) : (
              <CreateProjectForm />
            )}
          </CardContent>
        </Card>
      </div>
      <Preview />
    </div>
  );
}
