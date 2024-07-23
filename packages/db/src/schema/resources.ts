import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import type { ResourceMetadata } from "../types";
import { workspaces } from "./workspaces";

export const resourceProviders = pgEnum("resource_providers", ["postgres"]);

export const resources = pgTable("resources", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  provider: resourceProviders("provider").notNull(),
  metadata: jsonb("metadata").$type<ResourceMetadata>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
});

export const resourcesRelations = relations(resources, ({ one }) => ({
  workspace: one(workspaces, {
    fields: [resources.workspaceId],
    references: [workspaces.id],
  }),
}));

// Zod schemas
export const resourceProvidersSchema = z.enum(resourceProviders.enumValues);
export const insertResourceSchema = z.discriminatedUnion("provider", [
  z.object({
    name: z
      .string()
      .min(1, {
        message: "Name is required.",
      })
      .transform((name) => name.replace(/\s+/g, " ").trim()),
    description: z.string(),
    provider: z.literal("postgres"),
    host: z.string(),
    port: z.string().transform((port) => Number(port)),
    user: z.string(),
    password: z.string(),
    database: z.string(),
    workspaceId: z.string(),
  }),
]);
export const postgresMetadataSchema = z.object({
  provider: z.literal("postgres"),
  host: z.string(),
  port: z.number(),
  user: z.string(),
  password: z.string(),
  database: z.string(),
});
export const resourceMetadataSchema = z.discriminatedUnion("provider", [
  postgresMetadataSchema,
]);
export const resourceSchema = createSelectSchema(resources, {
  metadata: resourceMetadataSchema,
});
