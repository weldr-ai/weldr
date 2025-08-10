import {
  type AnyPgColumn,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  vector,
} from "drizzle-orm/pg-core";

import { nanoid } from "@weldr/shared/nanoid";
import type { DeclarationMetadata } from "@weldr/shared/types/declarations";

import { integrationTemplates } from "./integration-templates";

export const declarationTemplates = pgTable(
  "declaration_templates",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    version: text("version").default("v1").notNull(),
    uri: text("uri"),
    path: text("path"),
    metadata: jsonb("metadata").$type<DeclarationMetadata>(),
    embedding: vector("embedding", { dimensions: 1536 }),
    source: text("source"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
    integrationTemplateId: text("integration_template_id")
      .references((): AnyPgColumn => integrationTemplates.id)
      .notNull(),
  },
  (table) => [
    index("declaration_template_created_at_idx").on(table.createdAt),
    index("declaration_template_embedding_idx").using(
      "hnsw",
      table.embedding.op("vector_cosine_ops"),
    ),
    unique("declaration_template_uri_unique").on(table.uri),
  ],
);
