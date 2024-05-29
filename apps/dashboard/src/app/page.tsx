import { Preview } from "~/components/preview";
import { ProjectsDialog } from "~/components/projects-dialog";
import { getProjects } from "~/lib/actions/projects";

export default async function Project(): Promise<JSX.Element> {
  const projects = await getProjects();

  return (
    <div className="flex w-full">
      <div
        id="dialogBackdrop"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      >
        <ProjectsDialog projects={projects} />
      </div>
      <Preview />
    </div>
  );
}
