import type { z } from "zod";
import type {
  databaseRelationshipSchema,
  databaseTableSchema,
  dbConfigSchema,
} from "../postgres/validators";

export type DbConfig = z.infer<typeof dbConfigSchema>;
export type DatabaseStructure = z.infer<typeof databaseTableSchema>[];
export type DatabaseTable = z.infer<typeof databaseTableSchema>;
export type DatabaseRelationship = z.infer<typeof databaseRelationshipSchema>;
