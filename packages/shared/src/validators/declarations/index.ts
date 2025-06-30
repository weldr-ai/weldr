import { z } from "zod";
import { declarationSpecsV1Schema } from "./v1";

export const declarationSpecsSchema = z.discriminatedUnion("version", [
  declarationSpecsV1Schema,
]);
