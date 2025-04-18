import { z } from "zod";
import { jsonSchema } from "../json-schema";
import { parameterObjectSchema } from "../openapi";

const transitionSchema = z
  .object({
    when: z
      .object({
        description: z
          .string()
          .describe(
            "What causes this change to happen (e.g., 'When the user submits the form', 'When new data arrives').",
          ),
        guard: z
          .array(z.string())
          .optional()
          .describe(
            "What conditions need to be true for this change to occur.",
          ),
      })
      .describe("The trigger for this change."),

    from: z
      .object({
        data: z
          .string()
          .describe(
            "Description of the information and content shown in this state (e.g., 'Empty form fields', 'User's profile information', 'List of recent orders').",
          ),
        ui: z
          .object({
            visible: z
              .array(z.string())
              .describe("What the user can see in this state."),
            enabled: z
              .array(z.string())
              .describe("What the user can do in this state."),
          })
          .describe("How the interface looks and behaves in this state."),
      })
      .describe("The starting state before the change."),

    to: z
      .object({
        data: z
          .string()
          .describe(
            "Description of the information and content that will be shown after the change.",
          ),
        ui: z
          .object({
            visible: z
              .array(z.string())
              .describe("What the user will see after the change."),
            enabled: z
              .array(z.string())
              .describe("What the user can do after the change."),
          })
          .describe("How the interface will look and behave after the change."),
      })
      .describe("The end state after the change."),

    effects: z
      .array(
        z.object({
          description: z
            .string()
            .describe(
              "What happens during this change and why it matters to the user.",
            ),
          target: z
            .string()
            .optional()
            .describe(
              "Which part of the interface or system is affected by this change.",
            ),
        }),
      )
      .describe("What happens during this change."),
  })
  .describe("Describes a change in the interface from one state to another.");

export const baseComponentSchema = z.object({
  name: z.string().describe("A unique name for this piece of the interface."),
  purpose: z
    .string()
    .describe("What this part of the interface helps users accomplish."),
  description: z
    .string()
    .describe(
      "An overview of what this part of the interface does and how it works.",
    ),
  properties: jsonSchema
    .optional()
    .describe("What information this interface piece needs to work."),
  rendersOn: z
    .enum(["server", "client", "both"])
    .optional()
    .describe("Where this interface piece is displayed."),

  initial: z
    .object({
      data: z
        .string()
        .describe(
          "Description of what information is shown when this first appears (e.g., 'Empty form', 'Loading placeholder', 'Default settings').",
        ),
      ui: z
        .object({
          visible: z
            .array(z.string())
            .describe("What users see when this first appears."),
          enabled: z
            .array(z.string())
            .describe("What users can do when this first appears."),
        })
        .describe("How this looks and works when it first appears."),
    })
    .describe("The starting state of this interface piece."),

  transitions: z
    .array(transitionSchema)
    .describe(
      "All the ways this interface piece can change in response to user actions or other events.",
    ),

  visualLayout: z
    .string()
    .optional()
    .describe("How this piece of the interface is arranged visually."),
  implementationNotes: z
    .string()
    .optional()
    .describe("Important technical details for building this interface piece."),
});

export const pageSchema = baseComponentSchema.extend({
  subtype: z.literal("page"),
  parameters: parameterObjectSchema
    .optional()
    .describe("The path and query parameters of the route"),
  route: z
    .string()
    .describe(
      "The route of the page in openapi format. Like /users/{id} or /users/new",
    ),
  meta: z
    .string()
    .optional()
    .describe(
      "Information about this page for search engines and social sharing.",
    ),
});

export const layoutSchema = baseComponentSchema.extend({
  subtype: z.literal("layout"),
  parameters: parameterObjectSchema
    .optional()
    .describe("The path and query parameters of the route"),
  route: z
    .string()
    .describe(
      "The route of the layout in openapi format. Like /users/{id} or /users/new",
    ),
  rendersOn: z.literal("server"),
  meta: z
    .string()
    .optional()
    .describe(
      "Default page information for search engines and social sharing.",
    ),
});

export const reusableComponentSchema = baseComponentSchema.extend({
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
  protected: z
    .boolean()
    .optional()
    .describe("Whether users need to be logged in to see this."),
  definition: z.discriminatedUnion("subtype", [
    pageSchema,
    layoutSchema,
    reusableComponentSchema,
  ]),
});
