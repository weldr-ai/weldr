import { z } from "zod";
import { jsonSchema } from "../json-schema";

export const functionSchema = z.object({
  type: z.literal("function"),
  name: z.string().describe("The name of the function"),
  description: z
    .string()
    .describe("Detailed description of the function purpose and behavior"),
  remarks: z
    .string()
    .nullable()
    .optional()
    .describe("Any additional information"),
  parameters: jsonSchema
    .nullable()
    .optional()
    .describe("The parameters of the function"),
  returns: jsonSchema
    .nullable()
    .optional()
    .describe("The return value of the function"),
  examples: z
    .string()
    .array()
    .nullable()
    .optional()
    .describe(
      "Usage examples of the function. WITHOUT imports, just the code.",
    ),
  throws: z
    .array(
      z.object({
        type: z.string(),
        description: z.string(),
      }),
    )
    .nullable()
    .optional()
    .describe("The exceptions that the function can throw"),
  implementationNotes: z
    .string()
    .nullable()
    .optional()
    .describe(
      "Any useful information for the developer to implement the function like the logical steps that need to be performed, etc.",
    ),
});
