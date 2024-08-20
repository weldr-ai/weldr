// {
//   id: text("id")
//     .primaryKey()
//     .$defaultFn(() => createId()),
//   name: text("name").notNull(),
//   description: text("description"),
//   createdAt: timestamp("created_at").defaultNow().notNull(),
//   updatedAt: timestamp("updated_at")
//     .defaultNow()
//     .$onUpdate(() => new Date())
//     .notNull(),
//   createdBy: text("created_by")
//     .references(() => users.id, { onDelete: "cascade" })
//     .notNull(),
// }

import { z } from "zod";

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  createdBy: z.string(),
});

export const insertWorkspaceSchema = z.object({
  name: z
    .string()
    .min(1, {
      message: "Name is required.",
    })
    .regex(/^[a-z0-9-]+$/, {
      message: "Name must only contain lowercase letters, numbers, and hyphens",
    })
    .regex(/^[a-z0-9].*[a-z0-9]$/, {
      message: "Name must not start or end with a hyphen",
    })
    .regex(/^(?!.*--).*$/, {
      message: "Name contain consecutive hyphens",
    })
    .transform((name) => name.replace(/\s+/g, "-").toLowerCase().trim()),
  description: z.string().optional(),
});
