import { pgEnum } from "drizzle-orm/pg-core";

export const declarationTypes = pgEnum("declaration_types", [
  "component",
  "endpoint",
  "function",
  "model",
  "other",
]);
