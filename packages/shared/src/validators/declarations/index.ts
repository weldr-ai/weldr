import { z } from "zod";
import { componentSchema } from "./component";
import { endpointSchema } from "./endpoint";
import { functionSchema } from "./function";
import { modelSchema } from "./model";
import { objectSchema } from "./object";
import { typeSchema } from "./type";

export const declarationMetadataSchema = z
  .discriminatedUnion("type", [
    endpointSchema,
    functionSchema,
    modelSchema,
    componentSchema,
    objectSchema,
    typeSchema,
  ])
  .and(
    z.object({
      internalDependencies: z
        .object({
          filePath: z
            .string()
            .describe(
              "Path to the dependency file in the following formate /path/to/file.ts",
            ),
          declarations: z
            .object({
              name: z
                .string()
                .describe("The name of the declaration imported from the file"),
              type: z
                .enum([
                  "function",
                  "model",
                  "endpoint",
                  "component",
                  "instance",
                  "type",
                ])
                .describe("The type of the declaration"),
              reason: z
                .string()
                .describe(
                  "The reason why this declaration is imported from the file",
                ),
            })
            .array()
            .describe(
              "The declarations that the source declaration depends on",
            ),
        })
        .array()
        .describe(
          "All the other internal declarations that the declaration depends on",
        ),
      externalDependencies: z
        .object({
          name: z.string().describe("The name of the npm package"),
          type: z
            .enum(["runtime", "development"])
            .describe("The type of the npm package"),
          reason: z
            .string()
            .describe("The reason why this npm package is used in the file"),
        })
        .array()
        .describe("All the external packages that the declaration depends on"),
    }),
  );
