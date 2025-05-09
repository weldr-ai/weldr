import { z } from "zod";
import { jsonSchema } from "../json-schema";
import { parameterObjectSchema } from "../openapi";

export const uiTransitionSchema = z.object({
  when: z.object({
    description: z
      .string()
      .describe(
        "A clear explanation of what the user does or what happens in the system that causes this change (e.g., 'The user clicks the blue Submit button at the bottom of the form', 'The system detects an error while processing the request', 'All required fields have been properly filled out')",
      ),
    event: z
      .string()
      .describe(
        "A simple description of the action or occurrence that triggers this change (e.g., 'The form has been submitted', 'An error occurred', 'The form is now complete')",
      ),
    guard: z
      .array(z.string())
      .optional()
      .describe(
        "A list of requirements that must be met before this change can happen (e.g., ['All required fields are filled out', 'The user has an active account', 'There is at least one item selected'])",
      ),
  }),

  from: z.object({
    state: z
      .string()
      .describe(
        "A description of the current situation before the change occurs (e.g., 'The user is filling out the form', 'The system is checking the information', 'The error message is being shown')",
      ),
    data: z
      .string()
      .optional()
      .describe(
        "A description of the information present before the change (e.g., 'The form is blank', 'Some fields have incorrect information', 'All information is filled in correctly')",
      ),
    visible: z
      .array(z.string())
      .optional()
      .describe(
        "A list of interface elements the user can see in this state (e.g., ['SubmitButton', 'ErrorMessage', 'LoadingSpinner'])",
      ),
    enabled: z
      .array(z.string())
      .optional()
      .describe(
        "A list of interface elements the user can interact with in this state (e.g., ['EmailInput', 'SubmitButton', 'CancelLink'])",
      ),
  }),

  to: z.object({
    state: z
      .string()
      .describe(
        "A description of the new situation after the change occurs (e.g., 'The system is processing the submitted information', 'The confirmation message is being displayed', 'The error details are being shown')",
      ),
    data: z
      .string()
      .optional()
      .describe(
        "A description of the information present after the change (e.g., 'The submitted information is being processed', 'The information has been saved successfully', 'The system encountered a problem')",
      ),
    visible: z
      .array(z.string())
      .optional()
      .describe(
        "A list of interface elements the user can see after the change (e.g., ['LoadingSpinner', 'SuccessMessage', 'RetryButton'])",
      ),
    enabled: z
      .array(z.string())
      .optional()
      .describe(
        "A list of interface elements the user can interact with after the change (e.g., ['RetryButton', 'CloseButton'])",
      ),
  }),

  effects: z
    .array(z.string())
    .optional()
    .describe(
      "A list of important side effects (e.g., 'The information is sent to be stored', 'The user's preferences are saved', 'The page address is updated'). Just an English description and DOES NOT include any code.",
    ),
});

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
    .array(uiTransitionSchema)
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
