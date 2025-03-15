import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../schema";

const { Pool } = pg;

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set");
}

console.log("connectionString", connectionString);

const conn = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(conn, { schema });

// type Declaration = {
//   name: string;
//   dependencies: {
//     type: "internal" | "external";
//     from: string;
//     dependsOn: string[];
//   }[];
//   metadata: z.infer<typeof declarationMetadataSchema>;
// };

// type File = {
//   file: string;
//   declarations: Record<string, Declaration>;
// };

// // Get current file path in ESM
// const __filename = fileURLToPath(import.meta.url);
// const __dirname = dirname(__filename);

// async function readMetadataFiles(directory: string): Promise<File[]> {
//   const files: File[] = [];

//   async function readDir(currentPath: string) {
//     const entries = await fs.readdir(currentPath, { withFileTypes: true });

//     for (const entry of entries) {
//       const fullPath = path.join(currentPath, entry.name);

//       if (entry.isDirectory()) {
//         await readDir(fullPath);
//       } else if (
//         entry.isFile() &&
//         entry.name.endsWith(".json") &&
//         entry.name !== "packages.json"
//       ) {
//         const content = await fs.readFile(fullPath, "utf-8");
//         const json = JSON.parse(content) as File;

//         files.push({
//           file: json.file,
//           declarations: json.declarations,
//         });
//       }
//     }
//   }

//   await readDir(directory);
//   return files;
// }

async function seed() {
  try {
    // await db.transaction(async (tx) => {
    //   const metadataPath = path.join(
    //     __dirname,
    //     "../../..",
    //     "presets",
    //     "next-base",
    //   );
    //   const packagesPath = path.join(
    //     __dirname,
    //     "../../..",
    //     "presets",
    //     "next-base",
    //     "packages.json",
    //   );
    //   const files = await readMetadataFiles(metadataPath);

    //   const packages = JSON.parse(await fs.readFile(packagesPath, "utf-8")) as {
    //     type: "runtime" | "development";
    //     name: string;
    //   }[];

    //   const [nextBasePreset] = await tx
    //     .insert(schema.presets)
    //     .values({
    //       type: "next-base",
    //       name: "Next.js Base",
    //       description: "A preset for Next.js projects",
    //     })
    //     .returning();

    //   if (!nextBasePreset) {
    //     throw new Error("Next.js Base preset not found");
    //   }

    //   for (const file of files) {
    //     await tx
    //       .insert(schema.presetDeclarations)
    //       .values(
    //         Object.entries(file.declarations).map(([name, declaration]) => ({
    //           presetId: nextBasePreset.id,
    //           dependencies: declaration.dependencies,
    //           metadata: declaration.metadata,
    //           file: file.file,
    //           type: declaration.metadata.type,
    //           link: `${file.file}#${name}`,
    //         })),
    //       )
    //       .onConflictDoNothing({
    //         target: [
    //           schema.presetDeclarations.link,
    //           schema.presetDeclarations.presetId,
    //         ],
    //       });

    //     await tx
    //       .insert(schema.presetFiles)
    //       .values({
    //         presetId: nextBasePreset.id,
    //         file: file.file,
    //       })
    //       .onConflictDoNothing({
    //         target: [schema.presetFiles.presetId, schema.presetFiles.file],
    //       });
    //   }

    //   await tx.insert(schema.presetPackages).values(
    //     packages.map((pkg) => ({
    //       presetId: nextBasePreset.id,
    //       type: pkg.type,
    //       name: pkg.name,
    //     })),
    //   );

    //   console.log(
    //     "Successfully updated preset with UI component declarations and packages",
    //   );
    // });

    await db.transaction(async (tx) => {
      const preset = await tx.query.presets.findFirst({
        where: eq(schema.presets.type, "next-base"),
        with: {
          declarations: true,
        },
      });

      if (!preset) {
        throw new Error("Next.js Base preset not found");
      }

      for (const declaration of preset.declarations) {
        const [_, nameWithDelimiter] = declaration.name.split("|");
        const name = nameWithDelimiter?.split("::")[1];

        if (!name) {
          throw new Error("Invalid declaration name");
        }

        await tx
          .update(schema.presetDeclarations)
          .set({
            name,
          })
          .where(eq(schema.presetDeclarations.id, declaration.id));
      }
    });
  } catch (error) {
    console.error("Error seeding predefined declarations:", error);
    throw error;
  } finally {
    await conn.end();
  }
}

seed();
