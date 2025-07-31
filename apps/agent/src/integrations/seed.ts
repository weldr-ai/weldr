import { db } from "@weldr/db";
import { integrationTemplates } from "@weldr/db/schema";
import type { IntegrationKey } from "@weldr/shared/types";
import { integrationRegistry } from "./registry";

export async function seedIntegrationTemplates(): Promise<void> {
  console.log("🔧 Seeding integration templates...");

  try {
    let inserted = 0;
    let updated = 0;

    const registeredIntegrations = integrationRegistry.getAll();

    console.log(
      `Found ${registeredIntegrations.length} registered integrations`,
    );

    await db.transaction(async (tx) => {
      for (const integration of registeredIntegrations) {
        const templateData = {
          name: integration.name,
          description: integration.description,
          category: integration.category,
          key: integration.key as IntegrationKey,
          version: integration.version,
          dependencies: integration.dependencies,
          variables: integration.variables,
          options: integration.options,
          allowMultiple: integration.allowMultiple,
          recommendedOptions: integration.recommendedOptions,
        };

        const result = await tx
          .insert(integrationTemplates)
          .values(templateData)
          .onConflictDoUpdate({
            target: [integrationTemplates.key, integrationTemplates.version],
            set: {
              name: templateData.name,
              description: templateData.description,
              category: templateData.category,
              dependencies: templateData.dependencies,
              variables: templateData.variables,
              options: templateData.options,
              allowMultiple: templateData.allowMultiple,
              recommendedOptions: templateData.recommendedOptions,
            },
          })
          .returning({
            id: integrationTemplates.id,
            key: integrationTemplates.key,
            version: integrationTemplates.version,
          });

        if (result.length > 0) {
          const templateRecord = await tx.query.integrationTemplates.findFirst({
            where: (templates, { eq, and }) =>
              and(
                eq(templates.key, integration.key as IntegrationKey),
                eq(templates.version, integration.version),
              ),
          });

          if (templateRecord) {
            const isNewRecord =
              templateRecord.createdAt.getTime() ===
              templateRecord.updatedAt.getTime();

            if (isNewRecord) {
              inserted++;
              console.log(
                `  ✅ Inserted: ${integration.key} v${integration.version}`,
              );
            } else {
              updated++;
              console.log(
                `  🔄 Updated: ${integration.key} v${integration.version}`,
              );
            }
          }
        }
      }
    });

    console.log(
      `🔧 Integration templates seeding completed: ${inserted} inserted, ${updated} updated`,
    );
  } catch (error) {
    console.error("❌ Error seeding integration templates:", error);
    throw error;
  }
}

/**
 * Run seed script directly if called
 */
async function main() {
  await seedIntegrationTemplates();
  console.log("✅ Integration templates seed completed successfully");
  process.exit(0);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Error running integration templates seed:", error);
    process.exit(1);
  });
}
