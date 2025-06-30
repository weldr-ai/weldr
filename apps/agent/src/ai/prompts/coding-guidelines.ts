export const codingGuidelines = `<tech_stack>
  - TypeScript (Programming language)
  - React (UI library)
  - Tanstack Router (Routing library)
  - Tanstack Start (Used for SSR only)
  - Hono (HTTP server)
  - oRPC (OpenAPI REST APIs that can be called as RPCs on the client)
  - shadcn/ui (UI library)
  - Lucide Icons (Icon library)
  - Tailwind CSS (CSS framework)
  - TanStack Query (Data fetching library)
  - Drizzle ORM (Database ORM)
  - PostgreSQL (Database)
  - better-auth (Authentication library)
  - zod (Validation library)
  - react-hook-form (Form library)
</tech_stack>

<full_stack_structure_guidelines>
  The project MUST follow this file structure:

  Project root directory:
  ├── public                        # Folder containing the static assets (images, fonts, etc.)
  ├── server                        # Folder containing the server-side code
  │   ├── db                        # Folder containing the database (Drizzle ORM)
  │   │   ├── schema                # Folder containing the database schema
  │   │   │   ├── [table-name].ts   # Database table file
  │   │   │   └── index.ts          # Database schema index file (Re-exports all the files in the schema folder)
  │   │   └── index.ts              # Database index file
  │   ├── lib                       # Folder containing the utility functions
  │   │   ├── utils.ts              # Utility functions
  │   │   ├── context.ts            # Hono context type
  │   │   ├── auth.ts               # Initialize authentication
  │   │   └── ...                   # Other utility functions
  │   ├── middlewares               # Folder containing the middlewares
  │   │   ├── auth.ts               # Authentication middleware
  │   │   ├── logger.ts             # Logger middleware
  │   │   └── ...                   # Other middlewares
  │   ├── orpc                      # Folder containing the oRPC utilities
  │   │   ├── routes                # Folder containing the oRPC API routes
  │   │   │   ├── root.ts           # oRPC API index file (Register all the routes here)
  │   │   │   ├── [route-name].ts   # oRPC API route file
  │   │   │   └── ...               # Other oRPC API route files
  │   │   ├── index.ts              # Contains the publicProcedure and protectedProcedure utilities
  │   │   ├── router.ts             # oRPC server-side router file
  │   │   └── utils.ts              # oRPC server-side utilities file
  │   ├── routes                    # Folder containing Hono routes
  │   │   ├── [route-name].ts       # Hono route file
  │   │   └── index.ts              # Export the list of Hono routes
  │   ├── api.ts                    # Hono API
  │   └── index.ts                  # Runs a Hono server (READ ONLY)
  ├── web                           # Tanstack Router client app
  │   ├── components                # Folder containing the shared components
  │   │   ├── ui                    # Folder containing the UI components (includes all shadcn/ui components)
  │   │   │   ├── button.tsx        # Button component
  │   │   │   └── ...               # Other UI components
  │   │   ├── error-boundary.tsx    # Error boundary component
  │   │   ├── mode-toggle.tsx       # Theme toggle dropdown component
  │   │   └── not-found.tsx         # Not found component
  │   ├── hooks                     # Folder containing the shared hooks
  │   │   ├── use-mobile.ts         # shadcn/ui useMobile hook
  │   │   └── ...                   # Other shared hooks
  │   ├── lib                       # Folder containing the utility functions
  │   │   ├── auth.ts               # Authentication client
  │   │   ├── orpc.ts               # oRPC client
  │   │   ├── seo.ts                # SEO utilities
  │   │   ├── utils.ts              # Utility functions
  │   │   └── ...                   # Other utility functions
  │   ├── routes                    # Folder containing the routes
  │   │   ├── [route-name].ts       # Route file
  │   │   ├── api.$.ts              # API entry file (READ ONLY)
  │   │   └── __root.ts             # Tanstack Router Root route file (READ ONLY)
  │   ├── styles                    # Styles folder
  │   │   └── app.css               # App styles contains shadcn/ui global styles
  │   ├── router.tsx                # Tanstack Router Main router file (READ ONLY)
  ├── .dockerignore
  ├── .gitignore
  ├── biome.json
  ├── bun.lock
  ├── components.json
  ├── drizzle.config.ts
  ├── Dockerfile
  ├── fly.toml
  ├── package.json
  ├── tsconfig.json
  └── vite.config.ts
</full_stack_structure_guidelines>

<web_only_structure_guidelines>
  The project MUST follow this file structure:

  Project root directory:
  ├── public                        # Folder containing the static assets (images, fonts, etc.)
  ├── src                           # Folder containing the client-side code
  │   ├── components                # Folder containing the shared components
  │   │   ├── ui                    # Folder containing the UI components (includes all shadcn/ui components)
  │   │   │   ├── button.tsx        # Button component
  │   │   │   └── ...               # Other UI components
  │   │   ├── error-boundary.tsx    # Error boundary component
  │   │   ├── mode-toggle.tsx       # Theme toggle dropdown component
  │   │   └── not-found.tsx         # Not found component
  │   ├── hooks                     # Folder containing the shared hooks
  │   │   ├── use-mobile.ts         # shadcn/ui useMobile hook
  │   │   └── ...                   # Other shared hooks
  │   ├── lib                       # Folder containing the utility functions
  │   │   ├── auth.ts               # Authentication client
  │   │   ├── orpc.ts               # oRPC client
  │   │   ├── seo.ts                # SEO utilities
  │   │   ├── utils.ts              # Utility functions
  │   │   └── ...                   # Other utility functions
  │   ├── routes                    # Folder containing the routes
  │   │   ├── [route-name].ts       # Route file
  │   │   └── __root.ts             # Tanstack Router Root route file (READ ONLY)
  │   ├── styles                    # Styles folder
  │   │   └── app.css               # App styles contains shadcn/ui global styles
  │   └── router.tsx                # Tanstack Router Main router file (READ ONLY)
  ├── .dockerignore
  ├── .gitignore
  ├── biome.json
  ├── bun.lock
  ├── components.json
  ├── Dockerfile
  ├── fly.toml
  ├── package.json
  ├── tsconfig.json
  └── vite.config.ts
</web_only_structure_guidelines>

<server_only_structure_guidelines>
  Project root directory:
  ├── public                        # Folder containing the static assets (images, fonts, etc.)
  ├── src                           # Folder containing the server-side code
  │   ├── db                        # Folder containing the database (Drizzle ORM)
  │   │   ├── schema                # Folder containing the database schema
  │   │   │   ├── [table-name].ts   # Database table file
  │   │   │   └── index.ts          # Database schema index file (Re-exports all the files in the schema folder)
  │   │   └── index.ts              # Database index file
  │   ├── lib                       # Folder containing the utility functions
  │   │   ├── utils.ts              # Utility functions
  │   │   ├── context.ts            # Hono context type
  │   │   ├── auth.ts               # Initialize authentication
  │   │   └── ...                   # Other utility functions
  │   ├── middlewares               # Folder containing the middlewares
  │   │   ├── auth.ts               # Authentication middleware
  │   │   ├── logger.ts             # Logger middleware
  │   │   └── ...                   # Other middlewares
  │   ├── orpc                      # Folder containing the oRPC utilities
  │   │   ├── routes                # Folder containing the oRPC API routes
  │   │   │   ├── root.ts           # oRPC API index file (Register all the routes here)
  │   │   │   ├── [route-name].ts   # oRPC API route file
  │   │   │   └── ...               # Other oRPC API route files
  │   │   ├── index.ts              # Contains the publicProcedure and protectedProcedure utilities
  │   │   ├── router.ts             # oRPC server-side router file
  │   │   └── utils.ts              # oRPC server-side utilities file
  │   ├── routes                    # Folder containing Hono routes
  │   │   ├── [route-name].ts       # Hono route file
  │   │   └── index.ts              # Export the list of Hono routes
  │   ├── api.ts                    # Hono API
  │   └── index.ts                  # Runs a Hono server (READ ONLY)
  ├── .dockerignore
  ├── .gitignore
  ├── biome.json
  ├── bun.lock
  ├── drizzle.config.ts
  ├── Dockerfile
  ├── fly.toml
  ├── package.json
  └── tsconfig.json
</server_only_structure_guidelines>

<coding_style_guidelines>
  - MUST NOT use OOP concepts like classes, inheritance, etc.
  - MUST use functions and modules to implement the code.
  - MUST use named exports for utilities and sub-components
  - MUST use default exports for pages and layouts only
  - MUST use path aliases for imports with @/ prefix for client files at /web/**/* and @server/ prefix for server files at /server/**/*
  - SHOULD avoid imperative programming as much as possible.
  - SHOULD use declarative programming instead.
  - SHOULD use functional programming concepts like immutability, higher-order functions, etc.
  - Prefer using for .. of loops over forEach.
  - Prefer using map, filter, reduce, etc. over for .. in loops.
  - Prefer using async/await over promises.
  - Prefer using try/catch over .then().catch().

  <server_architecture_guidelines>
    - ALL server-related code MUST be written in the \`/server\` directory
    - MOST server functionality MUST be implemented as oRPC procedures
    - Database operations MUST be encapsulated within oRPC procedures
    - Business logic MUST reside in oRPC handlers
    - You can define Hono OpenAPI routes only for streaming endpoints like AI chat, otherwise use oRPC procedures.
    - File uploads, data processing, and API integrations MUST be oRPC procedures
    - Client-side code MUST communicate with the server exclusively through oRPC calls using Tanstack Query
  </server_architecture_guidelines>

  <example_code_style>
    \`\`\`
    // CORRECT: Type imports
    import type { User } from '@/types'
    import { type Config } from '@/config'

    // INCORRECT: Runtime type imports
    import { User } from '@/types'  // Wrong if User is only a type

    // CORRECT: Component imports
    import { Button } from '@/components/ui/button'
    import { ChevronRight } from 'lucide-react'

    // CORRECT: Utility imports
    import { cn } from '@/lib/utils'
    \`\`\`
  </example_code_style>
</coding_style_guidelines>

<tanstack_router_guidelines>
  - MUST create all route files in the \`/web/routes\` directory
  - MUST use \`createFileRoute\` to create routes
  - MUST use absolute paths for route definitions
  - MUST use kebab-case for route file names
  - MUST use camelCase for route parameter names
  - MUST use camelCase for search parameter names

  <route_naming_conventions>
    Rules:
    - __root.tsx: Root route file must be named __root.tsx and placed in routes root
    - . Separator: Use . to denote nested routes (e.g. blog.post -> /blog/post)
    - $ Token: Use $ for parameterized routes (e.g. $userId -> :userId)
    - _ Prefix: Use _ prefix for pathless layout routes
    - _ Suffix: Use _ suffix to exclude route from parent nesting
    - - Prefix: Use - prefix to exclude files/folders from route tree
    - (folder): Use parentheses for route groups (excluded from URL path)
    - index Token: Use index for matching parent route exactly
    - .route.tsx: Alternative way to define routes using route suffix

    Examples:
    - \`/web/routes/__root.tsx\` -> Root route file
    - \`/web/routes/users/index.tsx\` -> \`/users\`
    - \`/web/routes/users/$userId.tsx\` -> \`/users/:userId\`
    - \`/web/routes/users/$userId/posts/$postId.tsx\` -> \`/users/:userId/posts/:postId\`
    - \`/web/routes/users/$userId/posts/$postId/comments.tsx\` -> \`/users/:userId/posts/:postId/comments\`

    Pathless Layout Examples:
    - \`/web/routes/_app/route.tsx\` -> Pathless layout for all routes
    - \`/web/routes/_app/dashboard.tsx\` -> \`/dashboard\` (inherits app layout)
    - \`/web/routes/_app/settings.tsx\` -> \`/settings\` (inherits app layout)
    - \`/web/routes/_auth/route.tsx\` -> Pathless layout for auth routes
    - \`/web/routes/_auth/login.tsx\` -> \`/login\` (inherits auth layout)
    - \`/web/routes/_auth/register.tsx\` -> \`/register\` (inherits auth layout)
  </route_naming_conventions>

  <params_validation>
    - MUST use zod for params validation
    - MUST transform params to the correct type if needed
    - MUST use descriptive error messages

    Example:
    \`\`\`typescript
    export const Route = createFileRoute("/users/$userId")({
      params: z.object({
        userId: z.string()
          .min(1, "User ID is required")
          .transform(Number)
          .refine((n) => !isNaN(n), "User ID must be a number"),
      }),
    });
    \`\`\`
  </params_validation>

  <search_validation>
    - MUST use zod for search params validation
    - MUST provide default values when appropriate
    - MUST use camelCase for search param names

    Example:
    \`\`\`typescript
    export const Route = createFileRoute("/users")({
      search: z.object({
        page: z.number().default(1),
        perPage: z.number().default(10),
        sortBy: z.enum(["name", "email", "createdAt"]).default("createdAt"),
        sortOrder: z.enum(["asc", "desc"]).default("desc"),
        search: z.string().optional(),
      }),
    });
    \`\`\`
  </search_validation>

  <using_loaders>
    - MUST use loaders to prefetch data
    - MUST use the context object to access services
    - MUST handle errors appropriately
    - SHOULD use TanStack Query for data fetching

    Example:
    \`\`\`typescript
    export const Route = createFileRoute("/users/$userId")({
      params: z.object({
        userId: z.string().transform(Number),
      }),
      loader: async ({ context, params }) => {
        // Prefetch user data
        await context.queryClient.prefetchQuery(
          context.orpc.users.getById.queryOptions(params.userId)
        );

        // Prefetch user posts
        await context.queryClient.prefetchQuery(
          context.orpc.posts.getByUserId.queryOptions(params.userId)
        );
      },
      component: UserPage,
    });
    \`\`\`
  </using_loaders>

  <error_handling>
    - MUST handle errors in loaders
    - MUST provide meaningful error messages
    - SHOULD use error boundaries for component errors

    Example:
    \`\`\`typescript
    export const Route = createFileRoute("/users/$userId")({
      loader: async ({ context, params }) => {
        try {
          await context.queryClient.prefetchQuery(
            context.orpc.users.getById.queryOptions(params.userId)
          );
        } catch (error) {
          throw new Error("Failed to load user data");
        }
      },
      component: UserPage,
      errorComponent: ({ error }) => (
        <div className="text-destructive">
          <h1>Error</h1>
          <p>{error.message}</p>
        </div>
      ),
    });
    \`\`\`
  </error_handling>

  <auth_guidelines>
    - The session data is stored in the Tanstack Router context.
    - You can access the session data from the context object in the loader function.
    - Any protected route can just be added under the /_authed route group.

    Get the current session on the client:
    <example_getting_session_in_routes>
      /web/routes/_authed/some-route.tsx
      \`\`\`
      import { createFileRoute } from "@tanstack/react-router";

      export const Route = createFileRoute("/some-route")({
        loader: async ({ context }) => {
          return { session: context.session, user: context.user };
        },
        component: RouteComponent,
      });

      function RouteComponent() {
        const { user } = Route.useLoaderData();
        return <div>{user.email}</div>;
      }
      \`\`\`
  </example_getting_session_in_routes>

  <example_getting_session_in_components>
    /web/components/user-button.tsx
    \`\`\`
    import { useLoaderData } from "@tanstack/react-router";

    function UserButton() {
	    const { session } = useLoaderData({ from: "__root__" });
      return (
        <>
          {session ? (
            <div>Private Data</div>
          ) : (
            <div>Public Data</div>
          )}
        </>
      );
    }
    \`\`\`
    </example_getting_session_in_components>
  </auth_guidelines>
</tanstack_router_guidelines>

<oRPC_guidelines>
  - oRPC is already configured in the project.
  - MUST create all oRPC related files in the \`/server/orpc\` directory.
  - MUST use the \`publicProcedure\` and \`protectedProcedure\` to create your procedures.
  - MUST define OpenAPI specifications for all oRPC routes using the \`.route()\` method.
  - MUST implement optimistic updates for mutations to provide instant user feedback.

  <openapi_requirements>
    All oRPC routes MUST include OpenAPI specifications:
    - Import \`Route\` type from "@orpc/server"
    - Define an \`openAPI\` object with \`satisfies Route\`
    - Include: method, tags, path, successStatus, description, summary
    - Use appropriate HTTP methods (GET for queries, POST for mutations)
    - Use appropriate status codes (200 for queries, 201 for creation)
    - Group related routes with consistent tags
    - Provide clear descriptions and summaries
    - Use \`.route(openAPI)\` before \`.input()\` and \`.output()\`
    - Define separate files for each route operation
  </openapi_requirements>

  <route_registration>
    All oRPC routes MUST be registered in the router using a hierarchical structure:
    - Each route file should use default export
    - Each resource group MUST have an index file that creates a router for that group
    - MUST manually register new resource groups in the main router file
    - Routes are organized by resource with nested structure

    Example structure:
    /server/orpc/routes/todos/index.ts
    \`\`\`typescript
    import { base } from "@server/orpc";
    import create from "./create";
    import deleteRoute from "./delete";
    import find from "./find";
    import list from "./list";
    import update from "./update";

    export default base.router({
      create,
      find,
      list,
      update,
      delete: deleteRoute,
    });
    \`\`\`

    /server/orpc/router.ts
    \`\`\`typescript
    import health from "./routes/health";
    import todos from "./routes/todos";

    export const router = {
      health,
      todos,
    };
    \`\`\`

    Note: Use alias for reserved keywords (e.g., \`delete: deleteRoute\`)
  </route_registration>

  <optimistic_updates_guidelines>
    When implementing mutations, ALWAYS prefer optimistic updates:
    - Use \`onMutate\` to immediately update the UI before the server responds
    - Use temporary IDs (negative numbers) for new items being created
    - Use \`onError\` to roll back changes if the mutation fails
    - Use \`onSuccess\` to replace temporary data with server response
    - Use \`onSettled\` to ensure data consistency by invalidating queries
    - Cancel ongoing queries with \`queryClient.cancelQueries\` to prevent race conditions
    - Snapshot previous state for rollback on errors
    - Show visual feedback for optimistic items (e.g., opacity, disabled state)
  </optimistic_updates_guidelines>

  <example_oRPC_router>
    /server/orpc/routes/blogs/list.ts
    \`\`\`
    import type { Route } from "@orpc/server";
    import { db } from "@server/db";
    import { blogs, selectBlogSchema } from "@server/db/schema";
    import { publicProcedure } from "@server/orpc";
    import { z } from "zod";

    const openAPI = {
      method: "GET",
      tags: ["Blogs"],
      path: "/blogs",
      successStatus: 200,
      description: "Get list of blogs",
      summary: "Get blogs",
    } satisfies Route;

    export default publicProcedure
      .route(openAPI)
      .output(z.array(selectBlogSchema))
      .handler(async () => {
        return await db.select().from(blogs);
      });
    \`\`\`

    /server/orpc/routes/blogs/create.ts
    \`\`\`
    import type { Route } from "@orpc/server";
    import { db } from "@server/db";
    import { blogs, insertBlogSchema, selectBlogSchema } from "@server/db/schema";
    import { protectedProcedure } from "@server/orpc";

    const openAPI = {
      method: "POST",
      tags: ["Blogs"],
      path: "/blogs",
      successStatus: 201,
      description: "Create a new blog post",
      summary: "Create blog",
    } satisfies Route;

    export default protectedProcedure
      .route(openAPI)
      .input(insertBlogSchema)
      .output(selectBlogSchema)
      .handler(async ({ context, input }) => {
        const [blog] = await db
          .insert(blogs)
          .values({ ...input, userId: context.user.id })
          .returning();
        return blog;
      });
    \`\`\`
  </example_oRPC_router>

  <example_calling_oRPC_procedures_on_client>
    - You use the \`orpc\` client directly to call procedures with TanStack Query.
    - MUST implement optimistic updates for better user experience whenever possible.
    - SHOULD use \`onMutate\`, \`onError\`, and \`onSettled\` callbacks for proper state management.

    /web/routes/todos/index.tsx
    \`\`\`
    import { Button } from "@/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
    import { Checkbox } from "@/components/ui/checkbox";
    import { Input } from "@/components/ui/input";
    import { orpc } from "@/lib/orpc";
    import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
    import { createFileRoute } from "@tanstack/react-router";
    import { Loader2 } from "lucide-react";
    import { useState } from "react";
    import { toast } from "sonner";

    export const Route = createFileRoute("/todos/")({
      loader: async ({ context }) => {
        await context.queryClient.prefetchQuery(
          context.orpc.todos.list.queryOptions()
        );
      },
      component: TodosList,
    });

    function TodosList() {
      const [newTodoText, setNewTodoText] = useState("");
      const queryClient = useQueryClient();

      const todos = useQuery(orpc.todos.list.queryOptions());

      // Optimistic create mutation
      const createMutation = useMutation(
        orpc.todos.create.mutationOptions({
          onMutate: async (newTodo) => {
            // Cancel outgoing refetches
            await queryClient.cancelQueries(orpc.todos.list.queryOptions());

            // Snapshot previous value
            const previousTodos = queryClient.getQueryData(
              orpc.todos.list.key({ type: "query" }),
            );

            // Create temporary todo with negative ID
            const tempTodo = {
              id: -Date.now(),
              text: newTodo.text,
              completed: false,
              createdAt: new Date(),
            };

            // Optimistically update
            queryClient.setQueryData(
              orpc.todos.list.key({ type: "query" }),
              (old: typeof todos.data) => {
                if (!old) return [tempTodo];
                return [tempTodo, ...old];
              },
            );

            return { previousTodos, tempTodoId: tempTodo.id };
          },
          onError: (_error, _variables, context) => {
            // Roll back on error
            if (context?.previousTodos) {
              queryClient.setQueryData(
                orpc.todos.list.key({ type: "query" }),
                context.previousTodos,
              );
            }
            toast.error("Failed to create todo");
          },
          onSuccess: (data, _variables, context) => {
            // Replace temp todo with real one
            queryClient.setQueryData(
              orpc.todos.list.key({ type: "query" }),
              (old: typeof todos.data) => {
                if (!old) return [data];
                return old.map((todo) =>
                  todo.id === context?.tempTodoId ? data : todo,
                );
              },
            );
            setNewTodoText("");
          },
          onSettled: () => {
            // Ensure consistency
            queryClient.invalidateQueries(orpc.todos.list.queryOptions());
          },
        })
      );

      // Optimistic toggle mutation
      const toggleMutation = useMutation(
        orpc.todos.update.mutationOptions({
          onMutate: async (updatedTodo) => {
            await queryClient.cancelQueries(orpc.todos.list.queryOptions());

            const previousTodos = queryClient.getQueryData(
              orpc.todos.list.key({ type: "query" }),
            );

            // Optimistically update
            queryClient.setQueryData(
              orpc.todos.list.key({ type: "query" }),
              (old: typeof todos.data) => {
                if (!old) return old;
                return old.map((todo) =>
                  todo.id === updatedTodo.id
                    ? { ...todo, completed: updatedTodo.completed }
                    : todo,
                );
              },
            );

            return { previousTodos };
          },
          onError: (_error, _variables, context) => {
            if (context?.previousTodos) {
              queryClient.setQueryData(
                orpc.todos.list.key({ type: "query" }),
                context.previousTodos,
              );
            }
            toast.error("Failed to update todo");
          },
          onSettled: () => {
            queryClient.invalidateQueries(orpc.todos.list.queryOptions());
          },
        })
      );

      const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTodoText.trim()) {
          createMutation.mutate({ text: newTodoText });
        }
      };

      const handleToggle = (id: number, completed: boolean) => {
        toggleMutation.mutate({ id, completed: !completed });
      };

      return (
        <Card>
          <CardHeader>
            <CardTitle>Todo List</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="mb-4 flex gap-2">
              <Input
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Add a new task..."
                disabled={createMutation.isPending}
              />
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Add"
                )}
              </Button>
            </form>

            {todos.isLoading ? (
              <div className="flex justify-center">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <ul className="space-y-2">
                {todos.data?.map((todo) => {
                  const isOptimistic = todo.id < 0;
                  return (
                    <li key={todo.id} className={\`flex items-center gap-2 \${isOptimistic ? 'opacity-50' : ''}\`}>
                      <Checkbox
                        checked={todo.completed}
                        onCheckedChange={() => handleToggle(todo.id, todo.completed)}
                        disabled={isOptimistic}
                      />
                      <span>{todo.text}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      );
    }
    \`\`\`

    - Parametrized example:
    /web/routes/todos/$id.tsx
    \`\`\`
    import { orpc } from "@/lib/orpc";
    import { useQuery } from "@tanstack/react-query";
    import { createFileRoute } from "@tanstack/react-router";
    import { z } from "zod";

    export const Route = createFileRoute("/todos/$id")({
      params: z.object({
        id: z.string().transform(Number),
      }),
      loader: async ({ context, params }) => {
        await context.queryClient.prefetchQuery(
          context.orpc.todos.getById.queryOptions({ id: params.id })
        );
      },
      component: TodoPage,
    });

    function TodoPage() {
      const { id } = Route.useParams();
      const { data, error } = useQuery(orpc.todos.getById.queryOptions({ id }));

      if (error) {
        return <div>Error: {error.message}</div>;
      }

      return <div>{data?.text}</div>;
    }
    \`\`\`
  </example_calling_oRPC_procedures_on_client>
</oRPC_guidelines>

<forms_guidelines>
  - MUST use shadcn/ui form components for all forms
  - MUST use zod for schema validation with proper error messages
  - MUST use react-hook-form with zodResolver for form handling
  - MUST define form schemas separately with descriptive names
  - MUST use TypeScript type inference from zod schemas
  - SHOULD implement optimistic updates for form submissions

  <example_building_forms>
    /web/components/create-bookmark-form.tsx
    \`\`\`
    import { Button } from "@/components/ui/button";
    import {
      Form,
      FormControl,
      FormField,
      FormItem,
      FormLabel,
      FormMessage,
    } from "@/components/ui/form";
    import { Input } from "@/components/ui/input";
    import { orpc } from "@/lib/orpc";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { useMutation, useQueryClient } from "@tanstack/react-query";
    import { Loader2 } from "lucide-react";
    import { useForm } from "react-hook-form";
    import { toast } from "sonner";
    import { z } from "zod";

    // Form validation schema
    const createBookmarkSchema = z.object({
      url: z.string().url("Please enter a valid URL").min(1, "URL is required"),
      title: z.string().min(1, "Title is required").trim(),
      description: z.string().optional(),
    });

    type CreateBookmarkFormValues = z.infer<typeof createBookmarkSchema>;

    export function CreateBookmarkForm() {
      const queryClient = useQueryClient();

      const form = useForm<CreateBookmarkFormValues>({
        resolver: zodResolver(createBookmarkSchema),
        defaultValues: {
          url: "",
          title: "",
          description: "",
        },
      });

      const createMutation = useMutation(
        orpc.bookmarks.create.mutationOptions({
          onMutate: async (newBookmark) => {
            await queryClient.cancelQueries(orpc.bookmarks.list.queryOptions());

            const previousBookmarks = queryClient.getQueryData(
              orpc.bookmarks.list.key({ type: "query" }),
            );

            const tempBookmark = {
              id: -Date.now(),
              ...newBookmark,
              createdAt: new Date(),
            };

            queryClient.setQueryData(
              orpc.bookmarks.list.key({ type: "query" }),
              (old: any) => {
                if (!old) return [tempBookmark];
                return [tempBookmark, ...old];
              },
            );

            return { previousBookmarks };
          },
          onError: (_error, _variables, context) => {
            if (context?.previousBookmarks) {
              queryClient.setQueryData(
                orpc.bookmarks.list.key({ type: "query" }),
                context.previousBookmarks,
              );
            }
            toast.error("Failed to create bookmark");
          },
          onSuccess: () => {
            form.reset();
            toast.success("Bookmark created!");
          },
          onSettled: () => {
            queryClient.invalidateQueries(orpc.bookmarks.list.queryOptions());
          },
        })
      );

      const onSubmit = (values: CreateBookmarkFormValues) => {
        createMutation.mutate(values);
      };

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="url"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>URL</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="https://example.com"
                      disabled={createMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Bookmark title"
                      disabled={createMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief description"
                      disabled={createMutation.isPending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              disabled={
                !form.formState.isValid ||
                !form.formState.isDirty ||
                createMutation.isPending
              }
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Create Bookmark"
              )}
            </Button>
          </form>
        </Form>
      );
    }
    \`\`\`
  </example_building_forms>
</forms_guidelines>

<database_guidelines>
  - You MUST NOT configure Drizzle ORM, it can only be configured by calling the \`configure-database\` tool.
  - You can define the tables in the \`src/db/schema\` folder.
  - You can use the database instance in the \`src/server/db/index.ts\` file.

  <defining_tables>
    - Weldr MUST write each table in a separate file and export it in the index file.
    - Weldr MUST write the relations in the same file of the table.

    /server/db/schema/blogs.ts
    \`\`\`
    import { relations } from "drizzle-orm";
    import { pgTable, serial, text } from "drizzle-orm/pg-core";
    import { users } from "./users";

    export const blogs = pgTable("blogs", {
      id: serial("id").primaryKey(),
      title: text("title"),
      content: text("content"),
      userId: text("user_id").references(() => users.id),
    });

    export const blogsRelations = relations(blogs, ({ one }) => ({
      user: one(users, {
        fields: [blogs.userId],
        references: [users.id],
      }),
    }));
    \`\`\`

    After defining the table, you MUST export it in the index file.

    /server/db/schema/index.ts
    \`\`\`
    export * from "./blogs";
    export * from "./users";
    \`\`\`
  </defining_tables>
</database_guidelines>

<styling_guidelines>
  - MUST use shadcn/ui components from @/components/ui
  - MUST use Lucide React for icons
  - MUST use shadcn/ui css color variables
  - Tailwind CSS for styling

  <example_shadcn_ui_color_variables>
    \`\`\`
    export default function Component() {
      return (
        // CORRECT: Use semantic color variables
        <div className="bg-background text-foreground">
        {/* Primary colors */}
        <div className="bg-primary text-primary-foreground">Primary</div>

        {/* Secondary colors */}
        <div className="bg-secondary text-secondary-foreground">Secondary</div>

        {/* Accent colors */}
        <div className="bg-accent text-accent-foreground">Accent</div>

        {/* Muted colors */}
        <div className="bg-muted text-muted-foreground">Muted</div>

        {/* Card colors */}
        <div className="bg-card text-card-foreground">Card</div>

        {/* Destructive colors */}
        <div className="bg-destructive text-destructive-foreground">Destructive</div>
      )
    }
    \`\`\`
  </example_shadcn_ui_color_variables>
</styling_guidelines>

<use_native_apis>
  PREFER Native APIs:
  \`\`\`
  // CORRECT: Using native fetch
  async function getData() {
    const res = await fetch('/api/data')
    return res.json()
  }
  \`\`\`

  AVOID Unless Necessary:
  - HTTP client libraries when fetch is sufficient
</use_native_apis>

<state_management_guidelines>
  PREFER:
  - React's built-in useState/useReducer
  - Server Components for server state
  - TanStack Query for data caching
  - React Context for global UI state
  CONSIDER When Needed:
  - Zustand for complex client state
  - Jotai for atomic state
</state_management_guidelines>

<accessibility_guidelines>
  - Weldr implements accessibility best practices.
  - Use semantic HTML elements when appropriate, like main and header.
  - Make sure to use the correct ARIA roles and attributes.
  - Remember to use the "sr-only" Tailwind class for screen reader only text.
  - Add alt text for all images, unless they are purely decorative or unless it would be repetitive for screen readers.
</accessibility_guidelines>

<final_reminders>
  Remember these critical guidelines when building the application:

  1. **Server Architecture**:
     - ALL server code goes in /server directory
     - Use oRPC procedures for all server functionality (except streaming AI endpoints)
     - Client communicates with server ONLY through oRPC + TanStack Query

  2. **oRPC Requirements**:
     - Define OpenAPI specs for ALL routes with .route() method
     - Use publicProcedure or protectedProcedure appropriately
     - Create group index files with base.router()
     - Register routes in main router.ts manually

  3. **Optimistic Updates**:
     - ALWAYS implement optimistic updates for mutations
     - Use onMutate, onError, onSuccess, onSettled callbacks
     - Use negative IDs for temporary items
     - Show visual feedback for optimistic states

  4. **Forms & Validation**:
     - Use shadcn/ui Form components exclusively
     - Use react-hook-form with zodResolver
     - Define separate Zod schemas with descriptive names
     - Implement optimistic updates for form submissions

  5. **Database with Drizzle**:
     - One table per file in /server/db/schema
     - Export everything in schema/index.ts
     - Define relations in same file as table
     - Use proper TypeScript inference

  6. **File Structure**:
     - Follow the exact folder structure specified
     - Use @/ prefix for web imports, @server/ for server imports
     - Default exports only for pages/layouts, named exports otherwise

  7. **Styling**:
     - Use shadcn/ui components and color variables
     - Use Lucide React for icons
     - Follow accessibility guidelines with semantic HTML

  8. **TanStack Router**:
     - Use createFileRoute for all routes
     - Validate params and search with Zod
     - Prefetch data in loaders
     - Use proper error handling

  Common mistakes to avoid:
  - Creating server utilities outside of oRPC procedures
  - Forgetting OpenAPI specifications
  - Not implementing optimistic updates
  - Using incorrect import paths or prefixes
  - Missing form validation or using wrong form libraries
  - Creating files in wrong directories
</final_reminders>`;
