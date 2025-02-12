export const baseConventions = `<current_tech_stack>
  - TypeScript
  - React
  - Next.js 13+ App Router
  - shadcn/ui
  - Tailwind CSS
  - tRPC
  - TanStack Query
</current_tech_stack>

<folder_structure_conventions>
  The project MUST follow this file structure:
  Project root directory:
  ├── public                            # Folder containing the static assets (images, fonts, etc.)
  ├── src                               # Folder containing the source code
  │   ├── app                           # Folder containing the app routes
  │   │   ├── api                       # Folder containing the API routes
  │   │   ├── layout.tsx                # Root layout
  │   │   └── ...                       # Other app routes
  │   ├── server                        # Folder containing the server-side code
  │   │   ├── api                       # Folder containing the tRPC API
  │   │   │   ├── root.ts               # tRPC API index file (Register all the routers here)
  │   │   │   ├── trpc.ts               # tRPC API trpc file
  │   │   │   └── router                # Folder containing the tRPC API routers
  │   │   │       ├── [router-name].ts  # tRPC API router file
  │   │   │       └── ...               # Other tRPC API router files
  │   │   ├── db                        # Folder containing the database (Drizzle ORM), exists if the project requires a database
  │   │   │   ├── schema                # Folder containing the database schema
  │   │   │   │   ├── [table-name].ts   # Database table file
  │   │   │   │   └── index.ts          # Database schema index file (Re-exports all the files in the schema folder)
  │   │   │   └── index.ts              # Database index file
  │   │   ├── queries                   # Folder containing the database queries
  │   │   └── ...                       # Other server-side code like services, integrations, etc. For example: google-sheets.ts, stripe.ts, etc.
  │   ├── components                    # Folder containing the React components
  │   │   ├── ui                        # Folder containing the shadcn/ui components
  │   │   ├── forms                     # Folder containing the form components
  │   │   └── ...                       # Other components
  │   ├── lib                           # Folder containing the utility functions
  │   │   ├── trpc                      # Folder containing the tRPC utilities (MUST NOT ADD NEW FILES OR MODIFY ANYTHING INSIDE THIS FOLDER)
  │   │   │   ├── server.ts             # tRPC server-side utilities
  │   │   │   ├── react.ts              # tRPC client-side utilities
  │   │   │   └── query-client.ts       # tRPC query client
  │   │   ├── auth                      # Folder containing the authentication utilities (MUST NOT ADD ANY NEW FILES INSIDE THIS FOLDER)
  │   │   │   ├── index.tsx             # Better-Auth config file and exports the \`auth\` instance for server-side use (CAN MODIFY THIS FILE)
  │   │   │   └── react.ts              # Exports the \`auth\` instance for client-side use (MUST NOT MODIFY THIS FILE)
  │   │   ├── validators                # Folder containing the zod validations
  │   │   │   ├── [module-name].ts      # Module for a group of zod validation schemas
  │   │   │   └── ...                   # Other zod validation modules
  │   │   ├── utils.ts                  # Simple utility functions like cn, formatDate, etc.
  │   │   └── ...                       # Other utility functions
  │   ├── context                       # Folder containing the context providers
  │   ├── hooks                         # Folder containing the custom React hooks
  │   ├── types                         # Folder containing the TypeScript types
  │   └── styles                        # Folder containing the global styles
  ├── .eslintrc.cjs
  ├── .gitignore
  ├── bun.lockb
  ├── components.json
  ├── next.config.ts
  ├── package.json
  ├── postcss.config.ts
  ├── prettier.config.cjs
  ├── tailwind.config.ts
  └── tsconfig.json
</folder_structure_conventions>

<server_functions_conventions>
  - MUST import the \`server-only\` package on top of the file to ensure that the function is only executed on the server.
  - MUST create all server-related files in the \`/src/server\` directory.

  <example_server_function>
    /src/server/queries/blogs.ts
    \`\`\`typescript
      import "server-only";

      export async function getBlogs() {
        const blogs = await db.query.blogs.findMany();
        return blogs;
      }
    \`\`\`
  </example_server_function>
</server_functions_conventions>

<tRPC_conventions>
  - tRPC is already configured in the project.
  - MUST create all tRPC related files in the \`/src/server/api\` directory.
  - MUST use the \`createTRPCRouter\` function to create your routers.
  - MUST use the \`protectedProcedure\` and \`publicProcedure\` to create your procedures.
  - MUST use the \`api\` object to call the procedures.

  <example_tRPC_router>
    /src/server/api/routers/blogs.ts
    \`\`\`typescript
    import { createTRPCRouter, protectedProcedure, publicProcedure } from "@/server/api/trpc";
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
    - You are provided with an \`api\` object to call the procedures with TanStack Query.

    /src/components/blogs-list.tsx
    \`\`\`typescriptreact
    "use client";

    import { api } from "@/trpc/react";

    async function ClientComponent() {
      const { data, isPending, error } = api.posts.list.useQuery()

      if (isPending) return <div>Loading...</div>
      if (error) return <div>Error: {error.message}</div>

      return <div>{data}</div>
    }
    \`\`\`
  </example_calling_tRPC_procedures_on_client>

  <example_fetching_data_and_hydrating_client_on_server>
    - You are provided with an \`api\` object to call the procedures with TanStack Query.

    /src/app/blogs/page.tsx
    \`\`\`typescriptreact
    import { api, HydrateClient } from "@/trpc/server";

    function Hydration() {
      // Fetching data on the server using tRPC and TanStack Query
      const { data: hello } = api.hello.get.useQuery()

      // Prefetching data on the server using tRPC and TanStack Query
      void api.posts.list.prefetch()

      // This will hydrate the client component <PostsList /> with the data fetched on the server
      return (
        <HydrateClient>
          <div>{hello}</div>
          <PostsList />
        </HydrateClient>
      )
    }
    \`\`\`
  </example_fetching_data_and_hydrating_client_on_server>
</tRPC_conventions>

<authentication_conventions>
  - When setting up or updating authentication, you MUST use the \`configure-authentication\` tool.
  - You can only use the \`auth\` object at \`src/lib/auth/index.ts\` to get the current session on the server.
  - You can only use the \`auth\` object at \`src/lib/auth/react.ts\` to get the current session on the client.
  - MUST NOT use next.js middleware to handle authentication. Instead, you should check the session in routes.
  - Here is how the session object looks like:
    {
      session: {
          id: string;
          createdAt: Date;
          updatedAt: Date;
          userId: string;
          expiresAt: Date;
          token: string;
          ipAddress?: string | null | undefined | undefined;
          userAgent?: string | null | undefined | undefined;
      };
      user: {
          id: string;
          email: string;
          emailVerified: boolean;
          name: string;
          createdAt: Date;
          updatedAt: Date;
          image?: string | null | undefined | undefined;
      };
    } | null

  <example_getting_session_on_server>
    /src/app/blogs/page.tsx
    \`\`\`typescriptreact
    import { auth } from "@/lib/auth";
    import { headers } from "next/headers";

    // This is the ONLY way to get the session on the server
    const session = await auth.api.getSession({ headers: await headers() });

    if (!session) {
      redirect("/login");
    }

    // To get the user
    const user = session.user;

    return (
      <div>
        <h1>Protected Page</h1>
        <p>User: {user.email}</p>
      </div>
    );
    \`\`\`
  </example_getting_session_on_server>

  <example_getting_session_on_client>
    /src/components/user-button.tsx
    \`\`\`typescriptreact
    "use client";

    import { auth } from "@/lib/auth/react";

    function AccountSettings() {
      const { data: session } = auth.useSession();

      return <div>{session?.user?.email}</div>;
    }
    \`\`\`
  </example_getting_session_on_client>
</authentication_conventions>

<database_conventions>
  - You MUST NOT configure Drizzle ORM, it can only be configured by calling the \`configure-database\` tool.
  - You can define the tables in the \`src/db/schema\` folder.
  - You can use the database instance in the \`src/server/db/index.ts\` file.

  <defining_tables>
    - Weldr MUST write each table in a separate file and export it in the index file.
    - Weldr MUST write the relations in the same file of the table.

    /src/db/schema/blogs.ts
    \`\`\`typescript
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

    /src/db/schema/index.ts
    \`\`\`typescript
    export * from "./blogs";
    export * from "./users";
    \`\`\`
  </defining_tables>

  <using_database>
    - You can use the database instance in the \`src/server/db/index.ts\` file.
    - You can use anything from the \`drizzle-orm\` package.

    /src/server/db/queries/blogs.ts
    \`\`\`typescript
    import { db } from "@/server/db";
    import { blogs } from "@/server/db/schema";

    const blogs = await db.select().from(blogs);
    \`\`\`
  </using_database>
</database_conventions>

<styling_conventions>
  - MUST use shadcn/ui components from @/components/ui
  - MUST use Lucide React for icons
  - Tailwind CSS for styling
</styling_conventions>

<general_coding_conventions>
  - MUST use named exports for utilities and sub-components
  - MUST use default exports for pages and layouts only
  - MUST use path aliases for imports with @/ prefix

  <example_code_style>
    \`\`\`typescript
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
</general_coding_conventions>

<use_native_apis>
  PREFER Native APIs:
  \`\`\`typescript
  // CORRECT: Using native fetch
  async function getData() {
    const res = await fetch('/api/data')
    return res.json()
  }
  \`\`\`

  AVOID Unless Necessary:
  - HTTP client libraries when fetch is sufficient
</use_native_apis>

<state_management_requirements>
  PREFER:
  - React's built-in useState/useReducer
  - Server Components for server state
  - TanStack Query for data caching
  - React Context for global UI state
  CONSIDER When Needed:
  - Zustand for complex client state
  - Jotai for atomic state
</state_management_requirements>

<building_forms_conventions>
  - Use shadcn/ui form components
  - Use zod for schema validation
  - Use react-hook-form for form handling

  <example_building_forms>
    /src/components/create-bookmark-form.tsx
    \`\`\`typescriptreact
    "use client";

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
</building_forms_conventions>

<performance_requirements>
  - Native lazy loading
  - Built-in Next.js image optimization
</performance_requirements>

<accessibility_requirements>
  - Weldr implements accessibility best practices.
  - Use semantic HTML elements when appropriate, like main and header.
  - Make sure to use the correct ARIA roles and attributes.
  - Remember to use the "sr-only" Tailwind class for screen reader only text.
  - Add alt text for all images, unless they are purely decorative or unless it would be repetitive for screen readers.
</accessibility_requirements>

<nextjs_app_router_conventions>
  - MUST use Next.js 13+ App Router conventions
  - MUST group related routes in parentheses
  - MUST use proper file conventions:
    - page.tsx for pages
    - layout.tsx for layouts
    - loading.tsx for loading states
    - error.tsx for error states
    - not-found.tsx for 404 pages
  - MUST await headers(), cookies(), params, and searchParams.
    For example:

    /src/app/posts/[slug]/page.tsx
    \`\`\`typescriptreact
    import { headers } from "next/headers";
    import { cookies } from "next/headers";

    export default async function Page({
      params,
    }: {
      params: Promise<{ slug: string }>
    }) {
      const { slug } = await params
      const headersList = await headers()
      const userAgent = headersList.get('user-agent')

      return (
        <div>
          My Post: {slug}
          <br />
          User Agent: {userAgent}
        </div>
      )
    }
    \`\`\`
</nextjs_app_router_conventions>`;
