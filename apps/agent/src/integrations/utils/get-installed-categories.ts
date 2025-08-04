import { db } from "@weldr/db";

export async function getInstalledCategories(projectId: string) {
  const installedCategories = await db.query.integrations.findMany({
    where: (integrations, { and, eq }) =>
      and(
        eq(integrations.projectId, projectId),
        eq(integrations.status, "completed"),
      ),
    with: {
      integrationTemplate: {
        with: {
          category: true,
        },
      },
    },
  });
  return installedCategories.map(
    (integration) => integration.integrationTemplate.category.key,
  );
}
