import { seedAiModels } from "./scripts/seed-ai-models";

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
  await seedDatabase();
  process.exit(0);
}

// Run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Error running database seed:", error);
    process.exit(1);
  });
}
