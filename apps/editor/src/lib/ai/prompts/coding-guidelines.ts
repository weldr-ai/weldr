export const codingGuidelines = `<current_tech_stack>
  - TypeScript
  - React
  - Tanstack Router
  - Hono
  - shadcn/ui
  - Lucide Icons
  - Tailwind CSS
  - tRPC
  - TanStack Query
  - Drizzle ORM
  - PostgreSQL
  - better-auth
</current_tech_stack>

<folder_structure_guidelines>
  The project MUST follow this file structure:

  Project root directory:
  ├── public                            # Folder containing the static assets (images, fonts, etc.)
  ├── src                               # Folder containing the source code
  │   ├── server                        # Folder containing the server-side code
  │   │   ├── db                        # Folder containing the database (Drizzle ORM)
  │   │   │   ├── schema                # Folder containing the database schema
  │   │   │   │   ├── [table-name].ts   # Database table file
  │   │   │   │   └── index.ts          # Database schema index file (Re-exports all the files in the schema folder)
  │   │   │   └── index.ts              # Database index file
  │   │   ├── lib                       # Folder containing the utility functions
  │   │   │   ├── utils.ts              # Utility functions
  │   │   │   ├── auth.ts               # Initialize authentication
  │   │   │   └── ...                   # Other utility functions
  │   │   ├── trpc                      # Folder containing the tRPC utilities
  │   │   │   ├── routers               # Folder containing the tRPC API routers
  │   │   │   │   ├── root.ts           # tRPC API index file (Register all the routers here)
  │   │   │   │   ├── [router-name].ts  # tRPC API router file
  │   │   │   │   └── ...               # Other tRPC API router files
  │   │   │   ├── index.ts              # exports the tRPC router and types
  │   │   │   └── init.ts               # tRPC server-side initialization file
  │   │   ├── types.ts                  # TypeScript types
  │   │   └── index.ts                  # Index file containing the main hono app
  │   ├── web                           # Tanstack Router client app
  │   │   ├── components                # Folder containing the shared components
  │   │   │   ├── ui                    # Folder containing the UI components
  │   │   │   │   ├── button.tsx        # Button component
  │   │   │   │   └── ...               # Other UI components
  │   │   ├── hooks                     # Folder containing the shared hooks
  │   │   │   ├── use-bookmarks.ts      # useBookmarks hook
  │   │   │   └── ...                   # Other shared hooks
  │   │   ├── integrations              # Folder containing the integrations
  │   │   │   ├── trpc.ts               # tRPC integration
  │   │   │   └── tanstack-query.ts     # TanStack Query integration
  │   │   ├── lib                       # Folder containing the utility functions
  │   │   │   ├── utils.ts              # Utility functions
  │   │   │   ├── auth                  # Authentication client
  │   │   │   │   ├── client.ts         # Authentication client contains authClient instance
  │   │   │   │   └── index.ts          # Contains getSession server function which can be used in beforeLoad
  │   │   │   └── ...                   # Other utility functions
  │   │   ├── routes                    # Folder containing the routes
  │   │   │   ├── [route-name].ts       # Route file
  │   │   │   └── __root.ts             # Root route file (READ ONLY)
  │   │   ├── api.ts                    # API entry file (READ ONLY)
  │   │   ├── client.ts                 # Client entry file (READ ONLY)
  │   │   ├── router.tsx                # Main router file (READ ONLY)
  │   │   ├── ssr.ts                    # SSR entry file (READ ONLY)
  │   │   └── styles.ts                 # Global styles (READ ONLY)
  ├── .gitignore
  ├── app.config.ts
  ├── drizzle.config.ts
  ├── biome.json
  ├── bun.lock
  ├── components.json
  ├── package.json
  └── tsconfig.json
</folder_structure_guidelines>

<coding_style_guidelines>
  - MUST NOT use OOP concepts like classes, inheritance, etc.
  - MUST use functions and modules to implement the code.
  - MUST use named exports for utilities and sub-components
  - MUST use default exports for pages and layouts only
  - MUST use path aliases for imports with @/web/ prefix for client files (src/web) and @/server/ prefix for server files (src/server)
  - SHOULD avoid imperative programming as much as possible.
  - SHOULD use declarative programming instead.
  - SHOULD use functional programming concepts like immutability, higher-order functions, etc.
  - Prefer using for .. of loops over forEach.
  - Prefer using map, filter, reduce, etc. over for .. in loops.
  - Prefer using async/await over promises.
  - Prefer using try/catch over .then().catch().

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
  - MUST create all route files in the \`/src/web/routes\` directory
  - MUST use \`createFileRoute\` to create routes
  - MUST use absolute paths for route definitions
  - MUST use kebab-case for route file names
  - MUST use camelCase for route parameter names
  - MUST use snake_case for search parameter names

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
    - \`/src/web/routes/__root.tsx\` -> Root route file
    - \`/src/web/routes/users/index.tsx\` -> \`/users\`
    - \`/src/web/routes/users/$userId.tsx\` -> \`/users/:userId\`
    - \`/src/web/routes/users/$userId/posts/$postId.tsx\` -> \`/users/:userId/posts/:postId\`
    - \`/src/web/routes/users/$userId/posts/$postId/comments.tsx\` -> \`/users/:userId/posts/:postId/comments\`

    Pathless Layout Examples:
    - \`/src/web/routes/_app/route.tsx\` -> Pathless layout for all routes
    - \`/src/web/routes/_app/dashboard.tsx\` -> \`/dashboard\` (inherits app layout)
    - \`/src/web/routes/_app/settings.tsx\` -> \`/settings\` (inherits app layout)
    - \`/src/web/routes/_auth/route.tsx\` -> Pathless layout for auth routes
    - \`/src/web/routes/_auth/login.tsx\` -> \`/login\` (inherits auth layout)
    - \`/src/web/routes/_auth/register.tsx\` -> \`/register\` (inherits auth layout)
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
    - MUST use snake_case for search param names

    Example:
    \`\`\`typescript
    export const Route = createFileRoute("/users")({
      search: z.object({
        page: z.number().default(1),
        per_page: z.number().default(10),
        sort_by: z.enum(["name", "email", "created_at"]).default("created_at"),
        sort_order: z.enum(["asc", "desc"]).default("desc"),
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
          context.trpc.users.getById.queryOptions(params.userId)
        );

        // Prefetch user posts
        await context.queryClient.prefetchQuery(
          context.trpc.posts.getByUserId.queryOptions(params.userId)
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
            context.trpc.users.getById.queryOptions(params.userId)
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
    - Use the \`getSession\` function from \`@/web/lib/auth\` to get the current session
    - Handle unauthenticated users by redirecting them to the sign-in page
    - Use the \`beforeLoad\` hook to check authentication before loading the route

    Example:
    \`\`\`typescript
    import { getSession } from "@/web/lib/auth";
    import { redirect } from "@tanstack/react-router";

    export const Route = createFileRoute("/protected")({
      beforeLoad: async () => {
        const session = await getSession();
        if (!session) {
          throw redirect({ to: "/auth/sign-in" });
        }
      },
      component: ProtectedPage,
    });
    \`\`\`

    Get the current session on the client:
    <example_getting_session_on_client>
    /src/web/components/user-button.tsx
    \`\`\`
    import { authClient } from "@/web/lib/auth/client";

    function AccountSettings() {
      const { data: session, isPending } = authClient.useSession();

      if (isPending) {
        return <div>Loading...</div>;
      }

      if (!session) {
        return <div>Not signed in</div>;
      }

      return <div>{session?.user?.email}</div>;
    }
    \`\`\`
  </example_getting_session_on_client>
  </auth_guidelines>
</tanstack_router_guidelines>

<tRPC_guidelines>
  - tRPC is already configured in the project.
  - MUST create all tRPC related files in the \`/src/server/trpc\` directory.
  - MUST use the \`createTRPCRouter\` function to create your routers.
  - MUST use the \`protectedProcedure\` and \`publicProcedure\` to create your procedures.
  - MUST use the \`api\` object to call the procedures.

  <example_tRPC_router>
    /src/server/trpc/routers/blogs.ts
    \`\`\`
    import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/trpc/init";
    import { blogs } from "@/server/db/schema";

    export const blogsRouter = createTRPCRouter({
      // Example of public procedure
      list: publicProcedure.query(async ({ ctx }) => {
        return await ctx.db.select().from(blogs);
      }),

      // Example of protected procedure
      list: protectedProcedure.query(async ({ ctx }) => {
        return await ctx.db.select().from(blogs);
      }),
    });
    \`\`\`
  </example_tRPC_router>

  <example_calling_tRPC_procedures_on_client>
    - You are provided with an \`useTRPC\` hook to get the tRPC client instance and use it to call the procedures using TanStack Query.

    /src/web/routes/todos/index.tsx
    \`\`\`
    import { Button } from "@/web/components/ui/button";
    import { Card, CardContent, CardHeader, CardTitle } from "@/web/components/ui/card";
    import { useTRPC } from "@/web/integrations/trpc";
    import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
    import { createFileRoute } from "@tanstack/react-router";
    import { Loader2 } from "lucide-react";
    import { useState } from "react";

    export const Route = createFileRoute("/todos/")({
      loader: async ({ context }) => {
        // Prefetch todos data
        await context.queryClient.prefetchQuery(
          context.trpc.todos.getAll.queryOptions()
        );
      },
      component: TodosList,
    });

    function TodosList() {
      const [newTodoText, setNewTodoText] = useState("");
      const trpc = useTRPC();
      const queryClient = useQueryClient();

      // Fetch todos
      const todos = useQuery(trpc.todos.getAll.queryOptions());

      // Create mutation
      const createMutation = useMutation(
        trpc.todos.create.mutationOptions({
          onSuccess: () => {
            // Invalidate and refetch todos after creating
            queryClient.invalidateQueries(trpc.todos.getAll.queryFilter());
            setNewTodoText("");
          },
        })
      );

      // Toggle mutation
      const toggleMutation = useMutation(
        trpc.todos.toggle.mutationOptions({
          onSuccess: () => {
            // Invalidate and refetch todos after toggling
            queryClient.invalidateQueries(trpc.todos.getAll.queryFilter());
          },
        })
      );

      const handleAddTodo = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTodoText.trim()) {
          createMutation.mutate({ text: newTodoText });
        }
      };

      const handleToggleTodo = (id: number, completed: boolean) => {
        toggleMutation.mutate({ id, completed: !completed });
      };

      return (
        <Card>
          <CardHeader>
            <CardTitle>Todo List</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddTodo}>
              <input
                value={newTodoText}
                onChange={(e) => setNewTodoText(e.target.value)}
                placeholder="Add a new task..."
                disabled={createMutation.isPending}
              />
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? <Loader2 className="animate-spin" /> : "Add"}
              </Button>
            </form>

            {todos.isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <ul>
                {todos.data?.map((todo) => (
                  <li key={todo.id}>
                    <input
                      type="checkbox"
                      checked={todo.completed}
                      onChange={() => handleToggleTodo(todo.id, todo.completed)}
                    />
                    <span>{todo.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      );
    }
    \`\`\`

    - Parametrized example:
    /src/web/routes/todos/$id.tsx
    \`\`\`
    import { createFileRoute } from "@tanstack/react-router";

    export const Route = createFileRoute("/todos/$id")({
      // Validate the params
    	params: z.object({
        id: z.string().transform(Number),
      }),
      loader: async ({ context, params }) => {
        await context.queryClient.prefetchQuery(
          context.trpc.todos.getById.queryOptions(params.id)
        );
      },
      component: TodoPage,
    });

    function TodoPage() {
      const { id } = Route.useParams();
      const trpc = useTRPC();
      const { data, error } = useQuery(trpc.todos.getById.queryOptions({ id }));

      if (error) {
        return <div>Error: {error.message}</div>;
      }

      return <div>{data?.title}</div>;
    }
    \`\`\`
  </example_calling_tRPC_procedures_on_client>
</tRPC_guidelines>

<forms_guidelines>
  - Use shadcn/ui form components
  - Use zod for schema validation
  - Use react-hook-form for form handling

  <example_building_forms>
    /src/web/components/create-bookmark-form.tsx
    \`\`\`
    import { useForm } from "react-hook-form";
    import { zodResolver } from "@hookform/resolvers/zod";
    import { api } from "@/trpc/react";
    import { z } from "zod";

    const formSchema = z.object({
      link: z.string().url(),
    });

    export function CreateBookmarkForm() {
      const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
      });

      const utils = api.useUtils();

      const createPost = api.bookmarks.create.useMutation({
        onSuccess: () => {
          reset();
          void utils.bookmarks.list.invalidate();
        },
      });

      return (
        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => createPost.mutate(data))}>
            <FormField control={form.control} name="link" render={({ field }) => (
              <FormItem>
                <FormLabel>Link</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
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

    /src/server/db/schema/blogs.ts
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

    /src/server/db/schema/index.ts
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
</accessibility_guidelines>`;
