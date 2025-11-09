import { z } from "zod";

import { dbModelDeclarationSpecsSchema } from "./declarations/db-model";
import { endpointDeclarationSpecsSchema } from "./declarations/endpoint";
import { pageDeclarationSpecsSchema } from "./declarations/page";

const baseTaskSchema = z.object({
  id: z.number().describe(`
    Auto-incrementing unique task identifier.
    Always a positive integer starting from 1.
  `),
  summary: z.string().describe(`
    A concise summary of this task.
    Should be a single sentence that captures the essence of the task.

    Examples for declarations:
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

    Examples for generic tasks:
    - Fix login session timeout issue
    - Add email validation to registration form
    - Optimize database query performance
    - Update package dependencies
    - Add error handling to API routes
    - Fix responsive design on mobile
    - Add logging to authentication flow
    - Refactor user service methods
  `),
  description: z.string().describe(`
    Detailed specification for this task, including:
    - Functional requirements and objectives
    - Technical constraints and considerations
    - Expected behavior and outcomes
    - Integration points and dependencies
    - Context about the current state and what needs to change

    For declarations: Should provide enough context for an LLM to implement the entire feature without ambiguity.
    For generic tasks: Should clearly explain the problem, desired solution, and any constraints or requirements.

    Examples:
    - Declaration: "Create a user profile page that allows users to view and edit their personal information, including name, email, bio, and profile picture. The page should integrate with the user authentication system and provide real-time validation."
    - Generic task: "The login session expires too quickly (currently 15 minutes), causing users to be logged out while actively using the application. Update the session timeout to 2 hours and implement sliding session renewal to extend the session when users are active."
  `),
  acceptanceCriteria: z
    .string()
    .array()
    .describe(`
    Specific conditions that must be met for this task to be considered complete.
    Each criterion should be testable and verifiable.
    Each array item is a separate acceptance criterion.

    Examples for declarations:
    [
      "Model includes id, email, name, createdAt, updatedAt fields",
      "Email field has unique constraint and validation",
      "Passwords are properly hashed using bcrypt",
      "Model exports proper TypeScript types"
    ]

    Examples for generic tasks:
    [
      "Session timeout is set to 2 hours",
      "Active users have their sessions automatically renewed",
      "Session renewal works without interrupting user workflow",
      "All existing authentication tests pass",
      "Session timeout is configurable via environment variable"
    ]
  `),
  dependencies: z
    .number()
    .array()
    .optional()
    .describe(`
    Array of other task IDs that this task depends on.
    These are the direct dependencies that must be completed before this task can be started.

    For declarations: Usually references other declarations that provide required data models, API endpoints, or pages.
    For generic tasks: May reference other bug fixes, infrastructure changes, or feature implementations that are prerequisites.

    Examples:
    [] (no dependencies)
    [1] (depends on task 1 to complete first)
    [1, 3] (depends on both tasks 1 and 3 to complete first)
    [2, 4, 5] (depends on tasks 2, 4, and 5 to complete first)
  `),
  implementationNotes: z
    .string()
    .array()
    .optional()
    .describe(`
    Technical implementation guidance specific to this task.
    Should include patterns, conventions, libraries, or architectural decisions to follow.
    Each array item is a separate implementation note.

    Examples for declarations:
    [
      "Use Drizzle ORM schema definition in src/db/schema/",
      "Follow existing API endpoint patterns in src/api/routes/",
      "Use shadcn/ui components for consistent styling"
    ]

    Examples for generic tasks:
    [
      "Use express-rate-limit middleware for implementation",
      "Follow existing error handling patterns in src/lib/errors",
      "Update both client and server-side session management",
      "Add comprehensive logging using the existing logger utility",
      "Ensure backward compatibility with existing session tokens"
    ]
  `),
  subTasks: z
    .string()
    .array()
    .describe(`
    Implementation guidance broken into specific, actionable pieces for THIS task only.
    Each subtask should be a clear, concrete action that moves toward completing the overall task.
    Each array item is a separate subtask.

    Examples for declarations:
    [
      "Create form validation schema using Zod for blog post fields",
      "Build basic BlogPostForm component structure with react-hook-form + shadcn/ui inputs",
      "Integrate rich text editor with proper toolbar and formatting options",
      "Add image upload dropzone component with file validation and preview functionality",
      "Implement form field validation with real-time error feedback and styling",
      "Connect form submission to oRPC mutation with proper error handling",
      "Add loading states, disabled states, and loading indicators during submission",
      "Implement success/error toast notifications with appropriate messaging",
      "Create the page route and integrate the BlogPostForm component"
    ]

    Examples for generic tasks:
    [
      "Update session configuration in authentication middleware",
      "Implement sliding session renewal logic",
      "Add session timeout environment variable",
      "Update client-side session handling to respect new timeout",
      "Add tests for session renewal functionality",
      "Update authentication documentation with new session behavior",
      "Test session timeout with different user activity patterns",
      "Deploy and monitor session timeout changes"
    ]
  `),
});

const baseTaskDeclarationSchema = baseTaskSchema.extend({
  filePath: z.string().describe(`
    The file path of the declaration.
    Should be a valid file path.

    Examples:
    - src/db/schema/user.ts
    - src/orpc/routes/users/create.ts
    - src/routes/dashboard.tsx
    - server/db/schema/user.ts
    - server/orpc/routes/users/create.ts
    - web/routes/dashboard.tsx
  `),
});

const createTaskDeclarationSchema = baseTaskDeclarationSchema
  .extend({
    type: z.literal("declaration"),
    operation: z.literal("create"),
    specs: z.discriminatedUnion("type", [
      dbModelDeclarationSpecsSchema,
      endpointDeclarationSpecsSchema,
      pageDeclarationSpecsSchema,
    ]),
  })
  .describe(`
  A task that creates a new declaration (database model, API endpoint, or page).

  Examples:
  - Create a new User model in the database with fields for authentication
  - Create a POST /api/blog-posts endpoint for creating blog posts
  - Create a user profile page that displays and edits user information
  - Create a Product model with inventory tracking capabilities
  - Create a GET /api/users/:id endpoint for fetching user details
  - Create a dashboard page with analytics and user management
`);

const updateTaskDeclarationSchema = baseTaskDeclarationSchema
  .extend({
    type: z.literal("declaration"),
    operation: z.literal("update"),
    uri: z.string().describe(`
      The URI of the existing declaration to update.
      Must reference an existing declaration URI.
      Consist of file path and declaration name.

      Examples:
      - apps/server/src/db/schema/user.ts#User
      - apps/server/src/orpc/routes/users/create.ts#createUser
      - apps/web/src/routes/dashboard.tsx#DashboardPage
    `),
    specs: z
      .discriminatedUnion("type", [
        dbModelDeclarationSpecsSchema,
        endpointDeclarationSpecsSchema,
        pageDeclarationSpecsSchema,
      ])
      .describe("Updated specs if needed.")
      .optional(),
  })
  .describe(`
    A task that updates an existing declaration (database model, API endpoint, or page).

    Examples:
    - Update the User model to add a new 'avatar' field and profile picture functionality
    - Update the POST /api/blog-posts endpoint to include image upload capabilities
    - Update the user profile page to show account creation date and last login
    - Update the Product model to add category relationships and pricing tiers
    - Update the GET /api/users/:id endpoint to include user's recent activity
    - Update the dashboard page to add real-time notifications and messaging
  `);

export const declarationTaskSchema = z.discriminatedUnion("operation", [
  createTaskDeclarationSchema,
  updateTaskDeclarationSchema,
]);

export const genericTaskSchema = baseTaskSchema
  .extend({
    type: z.literal("generic"),
  })
  .describe(`
    A task that is not a declaration. These are general development tasks like bug fixes, enhancements, refactoring, testing, performance optimization, security improvements, etc.

    Examples:
    - Fix login session timeout issue causing premature logouts
    - Add email validation to prevent invalid email addresses in registration
    - Optimize database queries to improve page load times
    - Update package dependencies to latest secure versions
    - Add comprehensive error handling to API routes
    - Fix responsive design issues on mobile devices
    - Add detailed logging to authentication flow for debugging
    - Refactor user service methods to improve code maintainability
    - Add search functionality to the product catalog
    - Implement caching strategy to improve application performance
    - Add accessibility features to improve user experience
    - Set up monitoring and alerting for production environment
  `);

export const taskSchema = z.union([
  ...declarationTaskSchema.options,
  genericTaskSchema,
]);

export const planSchema = z.object({
  acceptanceCriteria: z
    .string()
    .array()
    .describe(`
      Plan-level acceptance criteria that validate the entire plan is complete.
      Each array item is a separate acceptance criterion for the overall plan.

      Examples:
      [
        "Users can register with email and password",
        "Users can log in and access protected pages",
        "Password reset functionality works via email",
        "User sessions persist across browser restarts",
        "Admin can view and manage user accounts"
      ]

      For a todo app:
      [
        "Users can add new tasks to their to-do list",
        "All tasks are displayed in a clean, organized manner",
        "The to-do list is saved in local storage and persists after a page refresh",
        "Users can mark tasks as complete",
        "Users can delete tasks from the list"
      ]
    `),
  tasks: z.array(taskSchema).describe(`
      Individual high-level tasks that need to be
      implemented to complete this plan. Each task represents a specific
      code artifact with its own specifications and acceptance criteria.
    `),
});
