import { db } from "@weldr/db";
import { integrationCategories, integrationTemplates } from "@weldr/db/schema";
import type { IntegrationKey } from "@weldr/shared/types";
import { integrationRegistry } from "./registry";

export async function seedIntegrationTemplates(): Promise<void> {
  console.log("🔧 Seeding integration templates...");

  try {
    let inserted = 0;
    let updated = 0;

    const registeredCategories = integrationRegistry.listCategories();

    console.log(`Found ${registeredCategories.length} registered categories`);

    await db.transaction(async (tx) => {
      for (const category of registeredCategories) {
        const [insertCategory] = await tx
          .insert(integrationCategories)
          .values({
            key: category.key,
            description: category.description,
            recommendedIntegrations: category.recommendedIntegrations,
            priority: category.priority,
            dependencies: category.dependencies,
          })
          .returning({
            id: integrationCategories.id,
          })
          .onConflictDoUpdate({
            target: [integrationCategories.key],
            set: {
              description: category.description,
              recommendedIntegrations: category.recommendedIntegrations,
              priority: category.priority,
              dependencies: category.dependencies,
            },
          });

        if (!insertCategory) {
          throw new Error(`Failed to insert category ${category.key}`);
        }

        for (const integration of Object.values(category.integrations)) {
          const templateData = {
            name: integration.name,
            description: integration.description,
            categoryId: insertCategory.id,
            key: integration.key as IntegrationKey,
            version: integration.version,
            variables: integration.variables,
            options: integration.options,
            allowMultiple: integration.allowMultiple,
            recommendedOptions: integration.recommendedOptions,
            isRecommended: integration.isRecommended,
          };

          const result = await tx
            .insert(integrationTemplates)
            .values(templateData)
            .onConflictDoUpdate({
              target: [integrationTemplates.key, integrationTemplates.version],
              set: {
                name: templateData.name,
                description: templateData.description,
                categoryId: insertCategory.id,
                variables: templateData.variables,
                options: templateData.options,
                recommendedOptions: templateData.recommendedOptions,
              },
            })
            .returning({
              id: integrationTemplates.id,
              key: integrationTemplates.key,
              version: integrationTemplates.version,
            });

          if (result.length > 0) {
            const templateRecord =
              await tx.query.integrationTemplates.findFirst({
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
