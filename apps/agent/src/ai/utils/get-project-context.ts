import { db, eq } from "@weldr/db";
import { integrations, type projects, versions } from "@weldr/db/schema";

export async function getProjectContext(project: typeof projects.$inferSelect) {
  const projectIntegrationsList = await db.query.integrations.findMany({
    where: eq(integrations.projectId, project.id),
    with: {
      integrationTemplate: true,
    },
  });

  const projectVersionsList = await db.query.versions.findMany({
    where: eq(versions.projectId, project.id),
    orderBy: (versions, { desc }) => [desc(versions.number)],
    limit: 5,
    columns: {
      number: true,
      message: true,
      description: true,
      changedFiles: true,
    },
  });

  return project.initiatedAt
    ? `You are working on a ${project.config?.server && project.config?.client ? "full-stack" : project.config?.server ? "server" : "client"} app called ${project.title}${
        projectIntegrationsList.length > 0
          ? `\nThis project has the following integrations setup:
${projectIntegrationsList
  .map((integration) => `- ${integration.integrationTemplate.name}`)
  .join(", ")}`
          : ""
      }${
        projectVersionsList.length > 0
          ? `\nLast 5 versions:
${projectVersionsList
  .map(
    (version) =>
      `#${version.number} ${version.message}
${version.description}
Changed files: ${version.changedFiles.map((file) => `- ${file.path} (${file.type})`).join("\n")}`,
  )
  .join("\n")}`
          : ""
      }`
    : "This is a new project";
}
