import { createId } from "@paralleldrive/cuid2";
import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const integrationTemplates = pgTable(
  "integration_templates",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    name: text("name").notNull(),
    key: text("key").notNull(),
    type: text("type").notNull(),
    version: text("version").notNull(),
    description: text("description").notNull(),
    llmTxt: text("llm_txt"),
    docsUrl: text("docs_url"),
    config: jsonb("config"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("integration_templates_created_at_idx").on(t.createdAt)],
);
