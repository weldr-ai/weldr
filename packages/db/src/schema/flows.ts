import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { users } from "./auth";
import { edges } from "./edges";
import { primitives } from "./primitives";
import { workspaces } from "./workspaces";

export const flowTypes = pgEnum("flow_types", [
  "component",
  "workflow",
  "route",
]);

export const flows = pgTable("flows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  name: text("name").notNull(),
  description: text("description"),
  type: flowTypes("type").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  workspaceId: text("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: text("created_by")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
});

export const flowsRelations = relations(flows, ({ many, one }) => ({
  primitives: many(primitives),
  edges: many(edges),
  user: one(users, {
    fields: [flows.createdBy],
    references: [users.id],
  }),
}));

// Zod schemas
export const flowTypesSchema = z.enum(flowTypes.enumValues);
export const flowSchema = createSelectSchema(flows);
export const insertFlowSchema = createInsertSchema(flows).omit({
  createdBy: true,
});

export const updateRouteFlowSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .transform((name) => name.replace(/\s+/g, " ").trim())
    .optional(),
  description: z.string().optional(),
  actionType: z.enum(["create", "read", "update", "delete"]).optional(),
  urlPath: z.string().optional(),
  inputs: z
    .object({
      id: z.string(),
      name: z.string(),
      testValue: z
        .union([z.string(), z.number()])
        .nullable()
        .optional()
        .default(null),
      type: z.enum(["number", "text", "functionResponse"]),
    })
    .array()
    .optional(),
});
