import { z } from "zod";
import { jsonSchema } from "../json-schema";

const baseComponentSchema = z.object({
  name: z.string().describe("The name of the component"),
  description: z
    .string()
    .describe("Detailed description of the component purpose and behavior"),
  remarks: z.string().optional().describe("The remarks of the component"),
  properties: jsonSchema.optional(),
  rendersOn: z
    .enum(["server", "client", "both"])
    .optional()
    .describe("Where the component renders on"),
  interactions: z
    .string()
    .array()
    .optional()
    .describe("The interactions that the user can perform on the component"),
  events: z
    .array(
      z.object({
        name: z.string().describe("Name of the event"),
        description: z
          .string()
          .describe("Description of what triggers this event"),
        sideEffects: z
          .array(z.string())
          .optional()
          .describe(
            "Side effects that occur when this event is emitted (e.g., API calls, navigation)",
          ),
      }),
    )
    .optional()
    .describe("Events that can be emitted by the component and their effects"),
  visualLayout: z
    .string()
    .optional()
    .describe(
      "A detailed description of how the component is laid out. For example, a sidebar with a list of items and a detail view to the right with a form.",
    ),
  implementationNotes: z
    .string()
    .optional()
    .describe(
      "Any useful information for the developer to implement the component",
    ),
});

const pageSchema = baseComponentSchema.extend({
  subtype: z.literal("page"),
  route: z.string().describe("The route of the page in openapi format"),
  meta: z
    .string()
    .optional()
    .describe(
      "A comprehensive description of the page's meta, encompassing both static and dynamic aspects, such as the title, description, and openGraph properties.",
    ),
});

const layoutSchema = baseComponentSchema.extend({
  subtype: z.literal("layout"),
  route: z
    .string()
    .optional()
    .describe("The route of the layout in openapi format"),
  rendersOn: z.literal("server"),
  meta: z
    .string()
    .optional()
    .describe(
      "A comprehensive description of the layout's meta, encompassing both static and dynamic aspects, such as the title, description, and openGraph properties.",
    ),
});

const reusableComponentSchema = baseComponentSchema.extend({
  subtype: z.literal("reusable"),
  examples: z
    .string()
    .array()
    .optional()
    .describe(
      "Usage examples of the component WITHOUT imports. Just the component usage. For example: <Button>Click me</Button>",
    ),
});

export const componentSchema = z.object({
  type: z.literal("component"),
  definition: z.discriminatedUnion("subtype", [
    pageSchema,
    layoutSchema,
    reusableComponentSchema,
  ]),
});
