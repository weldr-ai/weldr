import { and, db, eq } from "@weldr/db";
import type { projects } from "@weldr/db/schema";
import { integrations, versions } from "@weldr/db/schema";

export async function getProjectContext(project: typeof projects.$inferSelect) {
  const projectIntegrationsList = await db.query.integrations.findMany({
    where: eq(integrations.projectId, project.id),
    with: {
      integrationTemplate: {
        with: {
          category: true,
        },
      },
    },
  });

  const projectVersionsList = await db.query.versions.findMany({
    where: and(
      eq(versions.projectId, project.id),
      eq(versions.status, "completed"),
    ),
    orderBy: (versions, { desc }) => [desc(versions.number)],
    limit: 1,
  });

  return projectVersionsList.length > 0
    ? `You are working on an app called ${project.title} with the following integrations:
${projectIntegrationsList
  .map(
    (integration) =>
      `- ${integration.integrationTemplate.name} (${integration.integrationTemplate.category.key})`,
  )
  .join(", ")}`
    : "This is a new project";
}
