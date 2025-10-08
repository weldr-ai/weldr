import { db } from "@weldr/db";

export async function getInstalledCategories(versionId: string) {
  const installedIntegrations = await db.query.integrationVersions.findMany({
    where: (integrationVersions, { and, eq }) =>
      and(
        eq(integrationVersions.versionId, versionId),
        eq(integrationVersions.status, "installed"),
      ),
    with: {
      integration: {
        with: {
          integrationTemplate: {
            with: {
              category: true,
            },
          },
        },
      },
    },
  });
  return installedIntegrations.map(
    (iv) => iv.integration.integrationTemplate.category.key,
  );
}
