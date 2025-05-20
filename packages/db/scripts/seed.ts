import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { db, eq } from "../src";
import { presetDeclarations, presets } from "../src/schema/presets";

async function main() {
  await db.transaction(async (tx) => {
    const preset = await tx.query.presets.findFirst({
      where: eq(presets.type, "base"),
    });

    if (!preset) throw new Error("Preset not found");

    const presetId = preset.id;

    // Read JSON files from the declarations directory
    const declarationsDir = join(__dirname, "../../presets/src/base");
    const files = await readdir(declarationsDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = join(
        declarationsDir,
        "web/integrations/tanstack-query.json",
      );
      const content = await readFile(filePath, "utf-8");
      const declarationsFile = JSON.parse(content);

      console.log(JSON.stringify(declarationsFile, null, 2));

      // Insert the file path
      // await tx.insert(presetFiles).values({
      //   path: declarationsFile.path.startsWith("/")
      //     ? declarationsFile.path
      //     : `/${declarationsFile.path}`,
      //   presetId,
      // });

      // Insert the declaration
      for (const declaration of declarationsFile.declarations) {
        await tx
          .insert(presetDeclarations)
          .values({
            type: declaration.type,
            name: declaration.name,
            file: declarationsFile.path.startsWith("/")
              ? declarationsFile.path
              : `/${declarationsFile.path}`,
            specs: declaration,
            dependencies: declaration.dependencies,
            presetId,
          })
          .onConflictDoNothing();
      }

      break;
    }

    return preset;
  });

  console.log("✅ Successfully seeded database");
}

main().catch((e) => {
  console.error("❌ Error seeding database:", e);
  process.exit(1);
});
