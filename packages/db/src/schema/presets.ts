import { nanoid } from "@weldr/shared/nanoid";
import type { DeclarationSpecs, Theme } from "@weldr/shared/types";
import { relations } from "drizzle-orm";
import {
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { declarationTypes } from "./shared-enums";

interface InternalDependency {
  importPath?: string;
  dependsOn: string[];
}

interface ExternalDependency {
  name: string;
  importPath: string;
  dependsOn: string[];
}

export type DeclarationDependencies = {
  internal?: InternalDependency[];
  external?: ExternalDependency[];
};

export const presetTypes = pgEnum("preset_type", ["base"]);

export const presets = pgTable("presets", {
  id: text("id").primaryKey().$defaultFn(nanoid),
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
}));

export const presetDeclarations = pgTable(
  "preset_declarations",
  {
    id: text("id").primaryKey().$defaultFn(nanoid),
    type: declarationTypes("type").notNull(),
    name: text("name").notNull(),
    file: text("file").notNull(),
    specs: jsonb().$type<DeclarationSpecs>(),
    dependencies: jsonb().$type<DeclarationDependencies>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    presetId: text("preset_id")
      .notNull()
      .references(() => presets.id),
  },
  (t) => [unique("unique_preset_declaration").on(t.name, t.file, t.presetId)],
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

export const presetThemes = pgTable("preset_themes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  data: jsonb("data").$type<Theme>().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
