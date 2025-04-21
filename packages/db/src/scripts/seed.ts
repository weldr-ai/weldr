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

const deps = {
  "@hookform/resolvers": "^3.9.1",
  "@radix-ui/react-accordion": "^1.2.2",
  "@radix-ui/react-alert-dialog": "^1.1.3",
  "@radix-ui/react-aspect-ratio": "^1.1.1",
  "@radix-ui/react-avatar": "^1.1.2",
  "@radix-ui/react-checkbox": "^1.1.3",
  "@radix-ui/react-collapsible": "^1.1.2",
  "@radix-ui/react-context-menu": "^2.2.3",
  "@radix-ui/react-dialog": "^1.1.3",
  "@radix-ui/react-dropdown-menu": "^2.1.3",
  "@radix-ui/react-hover-card": "^1.1.3",
  "@radix-ui/react-label": "^2.1.1",
  "@radix-ui/react-menubar": "^1.1.3",
  "@radix-ui/react-navigation-menu": "^1.2.2",
  "@radix-ui/react-popover": "^1.1.3",
  "@radix-ui/react-progress": "^1.1.1",
  "@radix-ui/react-radio-group": "^1.2.2",
  "@radix-ui/react-scroll-area": "^1.2.2",
  "@radix-ui/react-select": "^2.1.3",
  "@radix-ui/react-separator": "^1.1.1",
  "@radix-ui/react-slider": "^1.2.2",
  "@radix-ui/react-slot": "^1.1.1",
  "@radix-ui/react-switch": "^1.1.2",
  "@radix-ui/react-tabs": "^1.1.2",
  "@radix-ui/react-toast": "^1.2.3",
  "@radix-ui/react-toggle": "^1.1.1",
  "@radix-ui/react-toggle-group": "^1.1.1",
  "@radix-ui/react-tooltip": "^1.1.5",
  "class-variance-authority": "^0.7.1",
  clsx: "^2.1.1",
  cmdk: "^1.0.0",
  "date-fns": "^3.6.0",
  "embla-carousel-react": "^8.5.1",
  "input-otp": "^1.4.1",
  "lucide-react": "^0.468.0",
  next: "15.1.0",
  "next-themes": "^0.4.4",
  react: "^18.3.1",
  "react-day-picker": "^8.10.1",
  "react-dom": "^18.3.1",
  "react-hook-form": "^7.54.1",
  "react-resizable-panels": "^2.1.7",
  recharts: "^2.15.0",
  "server-only": "^0.0.1",
  sonner: "^1.7.1",
  "tailwind-merge": "^2.5.5",
  "tailwindcss-animate": "^1.0.7",
  vaul: "^1.1.2",
  zod: "^3.24.1",
  "@types/eslint": "^8.56.10",
  "@types/node": "^22.10.9",
  "@types/react": "^18.3.16",
  "@types/react-dom": "^18.3.5",
  "@typescript-eslint/eslint-plugin": "^8.1.0",
  "@typescript-eslint/parser": "^8.1.0",
  eslint: "^8.57.0",
  "eslint-config-next": "^15.0.1",
  postcss: "^8.4.39",
  prettier: "^3.3.2",
  "prettier-plugin-tailwindcss": "^0.6.5",
  tailwindcss: "^3.4.3",
  typescript: "^5.5.3",
};

async function seed() {
  try {
    await db.transaction(async (tx) => {
      // Update existing packages with versions from deps
      for (const [name, version] of Object.entries(deps)) {
        await tx
          .update(schema.presetPackages)
          .set({ version })
          .where(eq(schema.presetPackages.name, name));

        await tx
          .update(schema.packages)
          .set({ version })
          .where(eq(schema.packages.name, name));
      }

      console.log("Successfully updated preset packages with versions");
    });
  } catch (error) {
    console.error("Error updating package versions:", error);
    throw error;
  } finally {
    await conn.end();
  }
}

seed();
