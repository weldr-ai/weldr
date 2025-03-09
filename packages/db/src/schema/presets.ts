import { createId } from "@paralleldrive/cuid2";
import type { DeclarationMetadata } from "@weldr/shared/types";
import { relations } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { packageType } from "./packages";
import { declarationTypes } from "./shared-enums";

export const presetTypes = pgEnum("preset_type", ["next-base"]);

export const presets = pgTable("presets", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  type: presetTypes("type").unique().notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const presetRelations = relations(presets, ({ many }) => ({
  declarations: many(presetDeclarations),
  files: many(presetFiles),
  packages: many(presetPackages),
}));

export const presetDeclarations = pgTable(
  "preset_declarations",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: declarationTypes("type").notNull(),
    link: text("link").notNull(),
    file: text("file").notNull(),
    metadata: jsonb().$type<DeclarationMetadata>(),
    dependencies:
      jsonb().$type<
        {
          type: "internal" | "external";
          from: string;
          dependsOn: string[];
        }[]
      >(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    presetId: text("preset_id")
      .notNull()
      .references(() => presets.id),
  },
  (t) => ({
    unique: unique("unique_preset_declaration").on(t.link, t.presetId),
  }),
);

export const presetDeclarationsRelations = relations(
  presetDeclarations,
  ({ one }) => ({
    preset: one(presets, {
      fields: [presetDeclarations.presetId],
      references: [presets.id],
    }),
  }),
);

export const presetPackages = pgTable(
  "preset_packages",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    type: packageType("type").notNull(),
    name: text("name").notNull(),
    presetId: text("preset_id")
      .references(() => presets.id)
      .notNull(),
  },
  (t) => ({
    unique: unique("unique_preset_package").on(t.name, t.presetId),
  }),
);

export const presetPackagesRelations = relations(presetPackages, ({ one }) => ({
  preset: one(presets, {
    fields: [presetPackages.presetId],
    references: [presets.id],
  }),
}));

export const presetFiles = pgTable(
  "preset_files",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    file: text("file").notNull(),
    presetId: text("preset_id")
      .references(() => presets.id)
      .notNull(),
  },
  (t) => ({
    unique: unique("unique_preset_file").on(t.file, t.presetId),
  }),
);

export const presetFilesRelations = relations(presetFiles, ({ one }) => ({
  preset: one(presets, {
    fields: [presetFiles.presetId],
    references: [presets.id],
  }),
}));
