import { argv } from "process";
import { fileURLToPath } from "url";

import { seedAiModels } from "./scripts/seed-ai-models";
import { seedProjectData } from "./scripts/seed-project-data";

/**
 * Main database seeding function
 * Orchestrates all available seed functions
 */
async function seedDatabase() {
  console.log("🌱 Starting database seeding...");

  try {
    // Seed AI models
    await seedAiModels();

    console.log("🌱 Database seeding completed successfully!");
  } catch (error) {
    console.error("❌ Database seeding failed:", error);
    process.exit(1);
  }
}

/**
 * Run seed script directly if called
 */
async function main() {
  const userId = argv.find((arg) => arg.startsWith("--userId="))?.split("=")[1];

  await seedDatabase();

  if (userId) {
    await seedProjectData(userId);
  }

  process.exit(0);
}

// Run if this file is executed directly
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((error) => {
    console.error("❌ Error running database seed:", error);
    process.exit(1);
  });
}
