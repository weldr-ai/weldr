import { db, eq } from "@weldr/db";
import { integrations, projects, versions } from "@weldr/db/schema";

export async function getProjectContext(projectId: string) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error("Project not found");
  }

  const projectIntegrationsList = await db.query.integrations.findMany({
    where: eq(integrations.projectId, projectId),
    with: {
      integrationTemplate: true,
    },
  });

  const projectVersionsList = await db.query.versions.findMany({
    where: eq(versions.projectId, projectId),
    orderBy: (versions, { desc }) => [desc(versions.number)],
    columns: {
      number: true,
      message: true,
      description: true,
      changedFiles: true,
    },
  });

  return project.initiatedAt
    ? `You are working on a ${project.config?.server && project.config?.client ? "full-stack" : project.config?.server ? "server" : "client"} app called ${project.name}${
        projectIntegrationsList.length > 0
          ? `\nThis project has the following integrations setup:
${projectIntegrationsList
  .map((integration) => `- ${integration.integrationTemplate.name}`)
  .join(", ")}`
          : ""
      }${
        projectVersionsList.length > 0
          ? `\nVersions:
${projectVersionsList
  .map(
    (version) =>
      `#${version.number} ${version.message}
${version.description}
Changed files: ${version.changedFiles.join(", ")}`,
  )
  .join("\n")}`
          : ""
      }`
    : "This is a new project";
}
