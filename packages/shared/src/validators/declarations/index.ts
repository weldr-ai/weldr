import { z } from "zod";
import { componentSchema } from "./component";
import { endpointSchema } from "./endpoint";
import { functionSchema } from "./function";
import { modelSchema } from "./model";
import { otherSchema } from "./other";

export const declarationMetadataSchema = z.discriminatedUnion("type", [
  endpointSchema,
  functionSchema,
  modelSchema,
  componentSchema,
  otherSchema,
]);
