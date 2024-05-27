import { relations } from "drizzle-orm";
import {
  boolean,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

import type { Input, Output } from "../types";

export const projects = pgTable("projects", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
});

export const projectsRelations = relations(projects, ({ many }) => ({
  flows: many(flows),
  workflows: many(workflows),
  accessPoints: many(accessPoints),
  resources: many(resources),
}));

export const flows = pgTable("flows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  dag: jsonb("dag"),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

export const flowsRelations = relations(flows, ({ one }) => ({
  author: one(projects, {
    fields: [flows.projectId],
    references: [projects.id],
  }),
}));

export const resources = pgTable("resources", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  provider: text("provider"),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

export const resourcesRelations = relations(resources, ({ one }) => ({
  author: one(projects, {
    fields: [resources.projectId],
    references: [projects.id],
  }),
}));

export const triggerTypes = pgEnum("trigger_types", ["event", "time"]);

export const workflows = pgTable("workflows", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  triggerType: triggerTypes("trigger_type"),
  flow: jsonb("flow"),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

export const workflowsRelations = relations(workflows, ({ one }) => ({
  author: one(projects, {
    fields: [workflows.projectId],
    references: [projects.id],
  }),
}));

export const actionTypes = pgEnum("action_types", [
  "retrieve",
  "submit",
  "modify",
  "delete",
]);

export const accessPoints = pgTable("access_point", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description"),
  actionType: actionTypes("action_type"),
  urlPath: text("url_path"),
  flow: jsonb("flow"),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});

export const accessPointsRelations = relations(accessPoints, ({ one }) => ({
  author: one(projects, {
    fields: [accessPoints.projectId],
    references: [projects.id],
  }),
}));

export const actionBlockTypes = pgEnum("action_block_types", [
  "query",
  "action",
  "logical_data_processing",
  "ai_data_processing",
]);

export const actionBlocks = pgTable("action_blocks", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text("name").notNull(),
  description: text("description").notNull(),
  actionBlockType: actionBlockTypes("action_block_type"),
  metadata: jsonb("metadata").$type<{
    resourceId: string;
    inputs: Input[];
    outputs: Output[];
    generatedCode: string;
  }>(),
  codeNotUpdated: boolean("code_not_updated"),
  createdAt: timestamp("created_at", {
    mode: "date",
    precision: 3,
  }).defaultNow(),
  updatedAt: timestamp("updated_at", {
    mode: "date",
    precision: 3,
  }).$onUpdate(() => new Date()),
  projectId: text("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
});
