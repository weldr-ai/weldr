import type { Theme } from "@weldr/shared/types";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "../schema";
import { presetThemes } from "../schema";

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
      const data = {
        name: "Blue Theme",
        data: {
          light: {
            background: "hsl(0, 0%, 100%)",
            foreground: "hsl(222.2, 84%, 4.9%)",

            card: "hsl(0, 0%, 100%)",
            cardForeground: "hsl(222.2, 84%, 4.9%)",

            popover: "hsl(0, 0%, 100%)",
            popoverForeground: "hsl(222.2, 84%, 4.9%)",

            primary: "hsl(221.2, 83.2%, 53.3%)",
            primaryForeground: "hsl(210, 40%, 98%)",

            secondary: "hsl(210, 40%, 96.1%)",
            secondaryForeground: "hsl(222.2, 47.4%, 11.2%)",

            muted: "hsl(210, 40%, 96.1%)",
            mutedForeground: "hsl(215.4, 16.3%, 46.9%)",

            accent: "hsl(210, 40%, 96.1%)",
            accentForeground: "hsl(222.2, 47.4%, 11.2%)",

            destructive: "hsl(0, 84.2%, 60.2%)",
            destructiveForeground: "hsl(210, 40%, 98%)",

            border: "hsl(214.3, 31.8%, 91.4%)",
            input: "hsl(214.3, 31.8%, 91.4%)",
            ring: "hsl(221.2, 83.2%, 53.3%)",

            chart1: "hsl(12, 76%, 61%)",
            chart2: "hsl(173, 58%, 39%)",
            chart3: "hsl(197, 37%, 24%)",
            chart4: "hsl(43, 74%, 66%)",
            chart5: "hsl(27, 87%, 67%)",

            sidebar: "hsl(0, 0%, 100%)",
            sidebarForeground: "hsl(222.2, 84%, 4.9%)",
            sidebarPrimary: "hsl(221.2, 83.2%, 53.3%)",
            sidebarPrimaryForeground: "hsl(210, 40%, 98%)",
            sidebarAccent: "hsl(210, 40%, 96.1%)",
            sidebarAccentForeground: "hsl(222.2, 47.4%, 11.2%)",
            sidebarBorder: "hsl(214.3, 31.8%, 91.4%)",
            sidebarRing: "hsl(221.2, 83.2%, 53.3%)",

            radius: 0.3,
          },
          dark: {
            background: "hsl(222.2, 84%, 4.9%)",
            foreground: "hsl(210, 40%, 98%)",

            card: "hsl(222.2, 84%, 4.9%)",
            cardForeground: "hsl(210, 40%, 98%)",

            popover: "hsl(222.2, 84%, 4.9%)",
            popoverForeground: "hsl(210, 40%, 98%)",

            primary: "hsl(217.2, 91.2%, 59.8%)",
            primaryForeground: "hsl(222.2, 47.4%, 11.2%)",

            secondary: "hsl(217.2, 32.6%, 17.5%)",
            secondaryForeground: "hsl(210, 40%, 98%)",

            muted: "hsl(217.2, 32.6%, 17.5%)",
            mutedForeground: "hsl(215, 20.2%, 65.1%)",

            accent: "hsl(217.2, 32.6%, 17.5%)",
            accentForeground: "hsl(210, 40%, 98%)",

            destructive: "hsl(0, 62.8%, 30.6%)",
            destructiveForeground: "hsl(210, 40%, 98%)",

            border: "hsl(217.2, 32.6%, 17.5%)",
            input: "hsl(217.2, 32.6%, 17.5%)",
            ring: "hsl(224.3, 76.3%, 48%)",

            chart1: "hsl(220, 70%, 50%)",
            chart2: "hsl(160, 60%, 45%)",
            chart3: "hsl(30, 80%, 55%)",
            chart4: "hsl(280, 65%, 60%)",
            chart5: "hsl(340, 75%, 55%)",

            sidebar: "hsl(222.2, 84%, 4.9%)",
            sidebarForeground: "hsl(210, 40%, 98%)",
            sidebarPrimary: "hsl(217.2, 91.2%, 59.8%)",
            sidebarPrimaryForeground: "hsl(222.2, 47.4%, 11.2%)",
            sidebarAccent: "hsl(217.2, 32.6%, 17.5%)",
            sidebarAccentForeground: "hsl(210, 40%, 98%)",
            sidebarBorder: "hsl(217.2, 32.6%, 17.5%)",
            sidebarRing: "hsl(224.3, 76.3%, 48%)",

            radius: 0.3,
          },
        },
      };

      await tx.insert(presetThemes).values({
        name: "Blue Theme",
        data: data as unknown as Theme,
      });
    });
  } catch (error) {
    console.error("Error updating package versions:", error);
    throw error;
  } finally {
    await conn.end();
  }
}

seed();
