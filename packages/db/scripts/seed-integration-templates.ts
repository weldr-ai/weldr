import { db } from "../src";
import { integrationTemplates } from "../src/schema";

/**
 * Seed data for integration templates
 */
const INTEGRATION_TEMPLATES_SEED_DATA: (typeof integrationTemplates.$inferInsert)[] =
  [
    // Backend integration template - system managed, single instance
    {
      name: "Backend (Hono)",
      description: "Server-side API and business logic using Hono framework",
      type: "backend",
      key: "hono",
      version: "1.0.0",
      isSystemManaged: true,
      allowMultiple: false,
    },
    // Frontend integration template - system managed, single instance
    {
      name: "Frontend (TanStack Start)",
      description: "Client-side application using TanStack Start framework",
      type: "frontend",
      key: "tanstack-start",
      version: "1.0.0",
      isSystemManaged: true,
      allowMultiple: false,
    },
    // Database integration template - user managed, multiple allowed
    {
      name: "PostgreSQL Database",
      description: "PostgreSQL relational database for data persistence",
      type: "database",
      key: "postgresql",
      version: "1.0.0",
      isSystemManaged: false,
      allowMultiple: true,
    },
    // Authentication integration template - user managed, multiple allowed
    {
      name: "Better Auth",
      description: "Authentication and authorization system using Better Auth",
      type: "authentication",
      key: "better-auth",
      version: "1.0.0",
      isSystemManaged: false,
      allowMultiple: true,
    },
  ];

/**
 * Seed integration templates
 */
export async function seedIntegrationTemplates(): Promise<void> {
  console.log("🔌 Seeding integration templates...");

  try {
    let inserted = 0;
    let updated = 0;

    for (const template of INTEGRATION_TEMPLATES_SEED_DATA) {
      const result = await db
        .insert(integrationTemplates)
        .values(template)
        .onConflictDoUpdate({
          target: [integrationTemplates.key, integrationTemplates.version],
          set: {
            name: template.name,
            description: template.description,
            type: template.type,
            isSystemManaged: template.isSystemManaged,
            allowMultiple: template.allowMultiple,
            updatedAt: new Date(),
          },
        })
        .returning({
          id: integrationTemplates.id,
          name: integrationTemplates.name,
          key: integrationTemplates.key,
        });

      if (result.length > 0) {
        // Check if this was an insert or update by checking if createdAt === updatedAt
        const insertedTemplate = await db.query.integrationTemplates.findFirst({
          where: (templates, { eq, and }) =>
            and(
              eq(templates.key, template.key),
              eq(templates.version, template.version),
            ),
        });

        if (insertedTemplate) {
          const isNewRecord =
            insertedTemplate.createdAt.getTime() ===
            insertedTemplate.updatedAt.getTime();
          if (isNewRecord) {
            inserted++;
            console.log(`  ✅ Inserted: ${template.name}`);
          } else {
            updated++;
            console.log(`  🔄 Updated: ${template.name}`);
          }
        }
      }
    }

    console.log(
      `🔌 Integration templates seeding completed: ${inserted} inserted, ${updated} updated`,
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
