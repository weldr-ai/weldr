import { and, eq, inArray } from "drizzle-orm";
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

async function seed() {
  try {
    await db.transaction(async (tx) => {
      const versionsList = await tx.query.versions.findMany({
        where: inArray(schema.versions.id, [
          "dhhppy38grjobhwt44bl5duz",
          "ofvf58nuvg8dk41ip387cz9m",
          "ju23cxwi96vjx20s9jhyzefs",
          "k9ohbiafplc8f77x1gyw2cu4",
        ]),
      });

      const filesList = {
        "/bun.lock": "zs0rSNEHGJVWNnB7xbpac4z2m2OF8VZn",
        "/package.json": "dwOFVTUEJl9plOsjeK87jpW3qv7F5Y05",
        "/tsconfig.json": "Ja1OuzDTuvNf5EnyL3VC6380g6QOS47U",
        "/.eslintrc.cjs": "0iw6nsDGqfDGVk8OQptMvPG1UyDs0cpn",
        "/tailwind.config.ts": "COT5q6NmAencK5SAxqXgvW17TXaH065E",
        "/postcss.config.mjs": "KMejU8KloqtNM.CtS8h9qVUSW6UTiMqs",
        "/prettier.config.cjs": "LrEALQTggicmMGqpArujKmVkupP0rfEY",
        "/next.config.ts": "GiAY5WE4CcB4kpn_6LkORzOBY3FObU0l",
        "/components.json": "QaBgTtYDipbQcF_JUqV9OnCMzVDYSOzEs",
        "/src/styles/globals.css": "fFFcx.C6uBdxgkEtNarLs9w19rj4nDHw",
        "/public/logo.svg": "6WlEID9bSqyJYAfJejVhDfQXz6LIpUKl",
      };

      for (const version of versionsList) {
        const files = await tx.query.files.findMany({
          where: and(
            eq(schema.files.projectId, version.projectId),
            inArray(
              schema.files.path,
              Object.keys(filesList).map((f) => f),
            ),
          ),
        });

        for (const file of files) {
          await tx.insert(schema.versionFiles).values({
            versionId: version.id,
            fileId: file.id,
            s3VersionId: filesList[file.path as keyof typeof filesList] ?? "",
          });
        }
      }
    });
  } catch (error) {
    console.error("Error updating package versions:", error);
    throw error;
  } finally {
    await conn.end();
  }
}

seed();
