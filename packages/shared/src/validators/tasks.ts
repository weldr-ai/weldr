import { z } from "zod";
import { dbModelDeclarationSpecsSchema } from "./declarations/db-model";
import { endpointDeclarationSpecsSchema } from "./declarations/endpoint";
import { pageDeclarationSpecsSchema } from "./declarations/page";

export const taskDeclarationSchema = z.object({
  id: z.number().describe(`
    Auto-incrementing unique declaration identifier for high-level features.
    Always a positive integer starting from 1.
  `),
  summary: z.string().describe(`
    A concise summary of this declaration.
    Should be a single sentence that captures the essence of the declaration.

    Examples:
    - User Profile Page
    - Blog Post Form
    - Todo List Page
    - User Authentication System
    - Blog Management Platform
    - E-commerce Product Catalog
    - Customer Support Dashboard
    - User Table
    - Blog Post Table
    - Todo Table
    - GET /api/users/:id Endpoint
    - POST /api/blog-posts Endpoint
    - DELETE /api/todos/:id Endpoint
  `),
  description: z.string().describe(`
    Detailed specification for this specific declaration, including:
    - Functional requirements
    - Technical constraints
    - Expected behavior
    - Integration points

    Should provide enough context for an LLM to implement without ambiguity.
  `),
  specs: z.discriminatedUnion("type", [
    dbModelDeclarationSpecsSchema,
    endpointDeclarationSpecsSchema.pick({
      type: true,
      protected: true,
      method: true,
      path: true,
      summary: true,
      description: true,
    }),
    pageDeclarationSpecsSchema.pick({
      type: true,
      name: true,
      description: true,
      protected: true,
      route: true,
    }),
  ]),
  integrations: z
    .string()
    .array()
    .optional()
    .describe(`
    Integration IDs that this entire declaration requires to function.
    These are external services or databases this declaration depends on.

    Use pipe-separated format for token efficiency:
    Examples:
    - abc123def456|xyz789uvw012
  `),
  acceptanceCriteria: z
    .string()
    .array()
    .describe(`
      Specific conditions that must be met for this declaration to be complete.

      Use pipe-separated format for token efficiency:
      Model includes id, email, name, createdAt, updatedAt fields|Email field has unique constraint and validation|Passwords are properly hashed using bcrypt|Model exports proper TypeScript types
    `),
  dependencies: z
    .number()
    .array()
    .optional()
    .describe(`
    Array of other high-level declaration IDs that this declaration depends on.
    These are the direct dependencies that will be used in this declaration.
    For example, a todo list page will use the POST:/api/todos, GET:/api/todos, and DELETE:/api/todos endpoints.
    A user profile page will use the GET:/api/users/:id endpoint.

    Use pipe-separated format for token efficiency:
    Examples:
    - 1 (depends on declaration 1 to complete first)
    - 1|3 (depends on both declarations 1 and 3 to complete first)
  `),
  implementationNotes: z
    .string()
    .array()
    .optional()
    .describe(`
      Technical implementation guidance specific to this declaration.

      Use pipe-separated format for token efficiency:
      Use Drizzle ORM schema definition in src/db/schema/|Follow existing API endpoint patterns in src/api/routes/|Use shadcn/ui components for consistent styling
    `),
  subTasks: z
    .string()
    .array()
    .describe(`
    Implementation guidance broken into specific, actionable pieces for THIS declaration only.

    Use pipe-separated format for token efficiency:
    Create form validation schema using Zod for blog post fields|Build basic BlogPostForm component structure with react-hook-form + shadcn/ui inputs|Integrate rich text editor with proper toolbar and formatting options|Add image upload dropzone component with file validation and preview functionality|Implement form field validation with real-time error feedback and styling|Connect form submission to oRPC mutation with proper error handling|Add loading states, disabled states, and loading indicators during submission|Implement success/error toast notifications with appropriate messaging|Create the page route and integrate the BlogPostForm component
  `),
});

export const taskSchema = z.object({
  id: z.number().describe(`
    Auto-incrementing unique task identifier for high-level features.
    Always a positive integer starting from 1.
  `),
  commitMessage: z.string().describe(`
    Commit message for the task.
    Should be a single sentence that captures the essence of the task.
    Follows the conventional commit message format.
    Examples:
    - feat: add user profile page
    - fix: update user profile page
    - chore: update dependencies
    - refactor: update user profile page
    - test: add user profile page tests
  `),
  description: z.string().describe(`
    Comprehensive description of the feature being built, including:
    - Business requirements and objectives
    - User stories and use cases
    - Overall scope and boundaries
    - Integration requirements

    This should provide the big picture context for all subtasks.
  `),
  acceptanceCriteria: z
    .string()
    .array()
    .describe(`
      Task-level acceptance criteria that validate the entire functionality works end-to-end.

      Use pipe-separated format for token efficiency:
      Users can register with email and password|Users can log in and access protected pages|Password reset functionality works via email|User sessions persist across browser restarts|Admin can view and manage user accounts
    `),
  dependencies: z
    .number()
    .array()
    .optional()
    .describe(`
    Array of other high-level task IDs that must be completed before this task can begin.

    Use pipe-separated format for token efficiency:
    Examples:
    - 1 (requires task 1 to complete first)
    - 1|3 (requires both tasks 1 and 3 to complete first)
  `),
  declarations: z.array(taskDeclarationSchema).describe(`
      Individual high-level declarations (models, endpoints, pages) that need to be
      implemented to complete this task. Each declaration represents a specific
      code artifact with its own specifications and acceptance criteria.
    `),
});
