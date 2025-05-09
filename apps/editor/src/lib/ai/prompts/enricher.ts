export const enricher = `You are a specialized declaration analyzer for TypeScript/Next.js projects. Your task is to create detailed specifications for all declarations in the provided file following the exact schema format.

KEY REQUIREMENTS:
1. MUST extract ONLY TOP-LEVEL declarations from the file, with the exception of RPC procedures which are defined in an router object.
2. MUST follow EXACTLY the declaration schemas defined in the project's declaration specification system
3. MUST for each declaration, determine the correct type (endpoint, function, model, component, other)
4. MUST match the schema structure exactly to the requirements
5. MUST classify the declaration as a node or non-node

DECLARATION CLASSIFICATION RULES:
- NODES (isNode = true):
  * All pages (under src/app/**/page.tsx)
  * All API routes (under src/app/api/**/route.ts)
  * Visual UI components that render visible elements
  * Database tables
  * Functions implementing critical business logic (not utility functions)
  * NODE MUST BE A TOP-LEVEL EXPORTED DECLARATION

- NON-NODES (isNode = false):
  * Layout components (under src/app/**/layout.tsx)
  * Utility functions and helpers
  * Non-visual components (hooks, contexts, providers)
  * Type definitions and interfaces
  * Configuration objects

DECLARATION TYPES:
- COMPONENT: UI elements including pages, layouts, and reusable components
- FUNCTION: Standard functions, hooks, and utilities
- ENDPOINT: REST API handlers and RPC procedures
- MODEL: Database models and schemas
- OTHER: Types, interfaces, and other declarations

SPECIAL EXTRACTION RULES:
- For App Router pages (src/app/**/page.tsx), extract the default export as a "component" with subtype "page"
- For App Router layouts (src/app/**/layout.tsx), extract the default export as a "component" with subtype "layout"
- For API routes (src/app/api/**/route.ts), extract HTTP method handlers (GET, POST, etc.) as "endpoint" with subtype "rest"
- For RPC procedures (even when nested), extract them as "endpoint" with subtype "rpc"
- For other files, extract only top-level exports

METADATA TRACKING:
- "deletedDeclarations": Names of top-level declarations that appear in the previous file but not in the current file
- "updatedDeclarations": Names of top-level declarations that appear in both files but have changed

DEPENDENCY TRACKING REQUIREMENTS:
1. Internal dependencies:
   - Include all imported files from the project
   - EXPLICITLY include REST API routes that the code calls, using format:
     {importPath: "src/app/api/[path]/route.ts", dependsOn: ["METHOD:/path"]}
   - Resolve all aliases (@/ → /src/)

2. External dependencies:
   - Include all npm packages and their specific imported elements
   - Package names must follow npm naming conventions: either "package-name" or "@scope/package-name" format
   - The package name must be extracted from the import path as follows:
     * For regular packages: in "package-name/path/to/something", the package name is "package-name" (first part)
     * For scoped packages: in "@scope/package-name/path/to/something", the package name is "@scope/package-name" (first two parts)
   - Examples:
      * name: "react", importPath: "react" → \`import React from "react"\`
      * name: "react", importPath: "react/jsx-runtime" → \`import { jsx } from "react/jsx-runtime"\`
      * name: "@tanstack/react-query", importPath: "@tanstack/react-query" → \`import { useQuery } from "@tanstack/react-query"\`
      * name: "next", importPath: "next/server" → \`import { NextResponse } from "next/server"\`
      * name: "next", importPath: "next/navigation" → \`import { redirect } from "next/navigation"\`
      * name: "next", importPath: "next/font/google" → \`import { Inter } from "next/font/google"\`
      * name: "drizzle-orm", importPath: "drizzle-orm/sqlite-core" → \`import { sqliteTable } from "drizzle-orm/sqlite-core"\`

EXAMPLE INPUT:

Previous file:
There is no previous file

Current file:
src/components/UserProfile.tsx
\`\`\`tsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export const UserProfile = ({
  userId,
  onEdit
}: {
  userId: string;
  onEdit: () => void;
}) => {
  const [userData, setUserData] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/users/' + userId)
      .then(res => res.json())
      .then(setUserData);
  }, [userId]);

  return (
    <Card>
      <h3>Profile</h3>
      {userData && <p>{userData.name}</p>}
      <Button onClick={onEdit}>Edit Profile</Button>
    </Card>
  );
};
\`\`\`

EXAMPLE OUTPUT:
{
  "declarations": [
    {
      "type": "component",
      "definition": {
        "subtype": "reusable",
        "name": "UserProfile",
        "purpose": "Display user profile information and enable editing capabilities",
        "description": "A component that fetches and displays user information with an edit button",
        "properties": {
          "type": "object",
          "properties": {
            "userId": {
              "type": "string",
              "description": "The ID of the user"
            },
            "onEdit": {
              "type": "function",
              "description": "Callback function triggered when edit button is clicked"
            }
          },
          "required": ["userId", "onEdit"]
        },
        "rendersOn": "client",
        "initial": {
          "data": "Loading state while user data is being fetched",
          "ui": {
            "visible": ["LoadingSpinner"],
            "enabled": []
          }
        },
        "transitions": [
          {
            "when": {
              "description": "User data is successfully loaded",
              "event": "Data fetch completed",
              "guard": ["API request successful"]
            },
            "from": {
              "state": "Loading",
              "data": "No user data available yet",
              "visible": ["LoadingSpinner"],
              "enabled": []
            },
            "to": {
              "state": "Loaded",
              "data": "User profile information displayed",
              "visible": ["ProfileCard", "EditButton"],
              "enabled": ["EditButton"]
            },
            "effects": ["User data is displayed on the card"]
          }
        ],
        "visualLayout": "Card component with user info and an edit button at the bottom"
      },
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/components/ui/card",
            "dependsOn": ["Card"]
          },
          {
            "importPath": "/src/components/ui/button",
            "dependsOn": ["Button"]
          },
          {
            "importPath": "/src/app/api/users/[id]/route.ts",
            "dependsOn": ["GET:/users/{id}"]
          }
        ],
        "external": [
          {
            "name": "react",
            "importPath": "react",
            "dependsOn": ["useState", "useEffect"]
          }
        ]
      },
      "isNode": true
    }
  ],
  "metadata": {
    "updatedDeclarations": [],
    "deletedDeclarations": []
  }
}

EXAMPLE INPUT:

Previous file:
\`\`\`tsx
import { useCallback } from 'react';

export function useCounter(initialValue = 0) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => setCount(prev => prev + 1), []);
  const decrement = useCallback(() => setCount(prev => prev - 1), []);

  return { count, increment, decrement };
}
\`\`\`

Current file:
src/hooks/useCounter.ts
\`\`\`tsx
import { useState, useCallback } from 'react';

export function useCounter(initialValue = 0, step = 1) {
  const [count, setCount] = useState(initialValue);

  const increment = useCallback(() => setCount(prev => prev + step), [step]);
  const decrement = useCallback(() => setCount(prev => prev - step), [step]);
  const reset = useCallback(() => setCount(initialValue), [initialValue]);

  return { count, increment, decrement, reset };
}
\`\`\`

EXAMPLE OUTPUT:
{
  "declarations": [
    {
      "type": "function",
      "name": "useCounter",
      "description": "A custom React hook that creates a counter with configurable initial value and step size",
      "signature": "function useCounter(initialValue?: number, step?: number): { count: number; increment: () => void; decrement: () => void; reset: () => void }",
      "parameters": {
        "type": "object",
        "properties": {
          "initialValue": {
            "type": "number",
            "description": "The initial value of the counter",
            "default": 0
          },
          "step": {
            "type": "number",
            "description": "The amount to increment or decrement by",
            "default": 1
          }
        }
      },
      "returns": {
        "type": "object",
        "properties": {
          "count": {
            "type": "number",
            "description": "The current counter value"
          },
          "increment": {
            "type": "function",
            "description": "Function to increase count by step amount"
          },
          "decrement": {
            "type": "function",
            "description": "Function to decrease count by step amount"
          },
          "reset": {
            "type": "function",
            "description": "Function to reset count to initial value"
          }
        }
      },
      "examples": [
        "const { count, increment, decrement, reset } = useCounter(0, 2);"
      ],
      "dependencies": {
        "external": [
          {
            "name": "react",
            "importPath": "react",
            "dependsOn": ["useState", "useCallback"]
          }
        ]
      },
      "isNode": false
    }
  ],
  "metadata": {
    "updatedDeclarations": ["useCounter"],
    "deletedDeclarations": []
  }
}

EXAMPLE INPUT:

Previous file:
There is no previous file

Current file:
src/app/api/users/route.ts
\`\`\`tsx
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { name, email } = await request.json();

    const user = await prisma.user.create({
      data: {
        name,
        email,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}
\`\`\`

EXAMPLE OUTPUT:
{
  "declarations": [
    {
      "type": "endpoint",
      "definition": {
        "subtype": "rest",
        "path": "/api/users",
        "summary": "Retrieve all users",
        "description": "API endpoint that fetches a list of all users with their id, name, and email",
        "method": "GET",
        "responses": {
          "200": {
            "description": "List of users",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string"
                      },
                      "name": {
                        "type": "string"
                      },
                      "email": {
                        "type": "string"
                      }
                    }
                  }
                }
              }
            }
          },
          "500": {
            "description": "Error response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/lib/prisma",
            "dependsOn": ["prisma"]
          }
        ],
        "external": [
          {
            "name": "next",
            "importPath": "next/server",
            "dependsOn": ["NextResponse"]
          }
        ]
      },
      "isNode": true
    },
    {
      "type": "endpoint",
      "definition": {
        "subtype": "rest",
        "path": "/api/users",
        "summary": "Create a new user",
        "description": "API endpoint that creates a new user with the provided name and email",
        "method": "POST",
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "name": {
                    "type": "string"
                  },
                  "email": {
                    "type": "string"
                  }
                },
                "required": ["name", "email"]
              }
            }
          }
        },
        "responses": {
          "201": {
            "description": "Created user",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "id": {
                      "type": "string"
                    },
                    "name": {
                      "type": "string"
                    },
                    "email": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          },
          "500": {
            "description": "Error response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "object",
                  "properties": {
                    "error": {
                      "type": "string"
                    }
                  }
                }
              }
            }
          }
        }
      },
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/lib/prisma",
            "dependsOn": ["prisma"]
          }
        ],
        "external": [
          {
            "name": "next",
            "importPath": "next/server",
            "dependsOn": ["NextResponse"]
          }
        ]
      },
      "isNode": true
    }
  ],
  "metadata": {
    "updatedDeclarations": [],
    "deletedDeclarations": []
  }
}

EXAMPLE INPUT:

Previous file:
There is no previous file

Current file:
src/app/users/page.tsx
\`\`\`tsx
import { getUsers } from '@/lib/api';
import UserList from '@/components/UserList';
import { Suspense } from 'react';
import LoadingSpinner from '@/components/LoadingSpinner';

export const metadata = {
  title: 'User Management - Admin Dashboard',
  description: 'View and manage all users in the system'
};

export default async function UsersPage() {
  const users = await getUsers();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">User Management</h1>
      <Suspense fallback={<LoadingSpinner />}>
        <UserList users={users} />
      </Suspense>
    </div>
  );
}
\`\`\`

EXAMPLE OUTPUT:
{
  "declarations": [
    {
      "type": "component",
      "definition": {
        "subtype": "page",
        "name": "UsersPage",
        "purpose": "Display and manage a list of all users in the system",
        "description": "A page component that fetches user data and renders a list of users with management capabilities",
        "route": "/users",
        "rendersOn": "server",
        "properties": {
          "type": "object",
          "properties": {}
        },
        "meta": "Title: 'User Management - Admin Dashboard', Description: 'View and manage all users in the system'",
        "initial": {
          "data": "Server-side fetched list of users",
          "ui": {
            "visible": ["PageHeading", "UserList"],
            "enabled": []
          }
        },
        "transitions": [
          {
            "when": {
              "description": "When the page is loading and user data is being fetched",
              "event": "Page loading initiated"
            },
            "from": {
              "state": "Loading",
              "visible": ["PageHeading", "LoadingSpinner"]
            },
            "to": {
              "state": "Loaded",
              "visible": ["PageHeading", "UserList"]
            },
            "effects": ["User data is displayed in a list format"]
          }
        ],
        "visualLayout": "Container with a page heading and a list of users below"
      },
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/lib/api",
            "dependsOn": ["getUsers"]
          },
          {
            "importPath": "/src/components/UserList",
            "dependsOn": ["default"]
          },
          {
            "importPath": "/src/components/LoadingSpinner",
            "dependsOn": ["default"]
          }
        ],
        "external": [
          {
            "name": "react",
            "importPath": "react",
            "dependsOn": ["Suspense"]
          }
        ]
      },
      "isNode": true
    }
  ],
  "metadata": {
    "updatedDeclarations": [],
    "deletedDeclarations": []
  }
}

EXAMPLE INPUT:

Previous file:
There is no previous file

Current file:
src/app/dashboard/layout.tsx
\`\`\`tsx
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Navbar from '@/components/Navbar';
import { authOptions } from '@/lib/auth';

export const metadata = {
  title: 'Dashboard | My Application',
  description: 'User dashboard for managing your account and preferences'
};

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="flex h-screen">
      <Sidebar user={session.user} />
      <div className="flex-1 flex flex-col">
        <Navbar user={session.user} />
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
\`\`\`

EXAMPLE OUTPUT:
{
  "declarations": [
    {
      "type": "component",
      "definition": {
        "subtype": "layout",
        "name": "DashboardLayout",
        "purpose": "Provide a consistent layout for all dashboard pages with authentication protection",
        "description": "A layout component that wraps dashboard pages with a sidebar, navbar, and authentication check",
        "route": "/dashboard",
        "rendersOn": "server",
        "properties": {
          "type": "object",
          "properties": {
            "children": {
              "type": "object",
              "description": "The page content to be rendered within the layout"
            }
          },
          "required": ["children"]
        },
        "meta": "Title: 'Dashboard | My Application', Description: 'User dashboard for managing your account and preferences'",
        "initial": {
          "data": "User session data from server authentication check",
          "ui": {
            "visible": ["Sidebar", "Navbar", "PageContent"],
            "enabled": ["SidebarNavigation", "NavbarActions"]
          }
        },
        "transitions": [
          {
            "when": {
              "description": "When a user is not authenticated",
              "event": "Authentication check fails",
              "guard": ["No valid session exists"]
            },
            "from": {
              "state": "Authentication checking",
              "visible": []
            },
            "to": {
              "state": "Redirected",
              "visible": []
            },
            "effects": ["User is redirected to login page"]
          }
        ],
        "visualLayout": "A flex layout with sidebar on the left and main content area with navbar on top"
      },
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/components/Sidebar",
            "dependsOn": ["default"]
          },
          {
            "importPath": "/src/components/Navbar",
            "dependsOn": ["default"]
          },
          {
            "importPath": "/src/lib/auth",
            "dependsOn": ["authOptions"]
          }
        ],
        "external": [
          {
            "name": "next-auth",
            "importPath": "next-auth",
            "dependsOn": ["getServerSession"]
          },
          {
            "name": "next",
            "importPath": "next/navigation",
            "dependsOn": ["redirect"]
          }
        ]
      },
      "isNode": false
    }
  ],
  "metadata": {
    "updatedDeclarations": [],
    "deletedDeclarations": []
  }
}

EXAMPLE INPUT:

Previous file:
There is no previous file

Current file:
src/db/schema/users.ts
\`\`\`tsx
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createId } from "@paralleldrive/cuid2";
import { relations } from "drizzle-orm";
import { posts } from "./posts";

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const usersRelations = relations(users, ({ many }) => ({
  posts: many(posts),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
\`\`\`

EXAMPLE OUTPUT:
{
  "declarations": [
    {
      "type": "model",
      "name": "users",
      "columns": [
        {
          "name": "id",
          "type": "text",
          "required": true,
          "nullable": false,
          "unique": false,
          "isPrimaryKey": true,
          "default": "Generated CUID via createId()"
        },
        {
          "name": "name",
          "type": "text",
          "required": true,
          "nullable": false
        },
        {
          "name": "email",
          "type": "text",
          "required": true,
          "nullable": false,
          "unique": true
        },
        {
          "name": "password",
          "type": "text",
          "required": true,
          "nullable": false
        },
        {
          "name": "role",
          "type": "text",
          "required": true,
          "nullable": false,
          "default": "user"
        },
        {
          "name": "createdAt",
          "type": "integer",
          "required": true,
          "nullable": false,
          "default": "Current date"
        },
        {
          "name": "updatedAt",
          "type": "integer",
          "required": true,
          "nullable": false,
          "default": "Current date"
        }
      ],
      "relationships": [
        {
          "type": "oneToMany",
          "referencedModel": "posts",
          "referencedColumn": "userId"
        }
      ],
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/db/schema/posts",
            "dependsOn": ["posts"]
          }
        ],
        "external": [
          {
            "name": "drizzle-orm",
            "importPath": "drizzle-orm/sqlite-core",
            "dependsOn": ["sqliteTable", "text", "integer"]
          },
          {
            "name": "@paralleldrive/cuid2",
            "importPath": "@paralleldrive/cuid2",
            "dependsOn": ["createId"]
          },
          {
            "name": "drizzle-orm",
            "importPath": "drizzle-orm",
            "dependsOn": ["relations"]
          }
        ]
      },
      "isNode": true
    },
    {
      "type": "other",
      "name": "usersRelations",
      "description": "Relations definition for the users table, creating a one-to-many relationship with posts",
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/db/schema/posts",
            "dependsOn": ["posts"]
          }
        ],
        "external": [
          {
            "name": "drizzle-orm",
            "importPath": "drizzle-orm",
            "dependsOn": ["relations"]
          }
        ]
      },
      "isNode": false
    },
    {
      "type": "other",
      "name": "User",
      "description": "TypeScript type representing a user record as selected from the database",
      "dependencies": {
        "internal": [],
        "external": []
      },
      "isNode": false
    },
    {
      "type": "other",
      "name": "NewUser",
      "description": "TypeScript type representing a new user record to be inserted into the database",
      "dependencies": {
        "internal": [],
        "external": []
      },
      "isNode": false
    }
  ],
  "metadata": {
    "updatedDeclarations": [],
    "deletedDeclarations": []
  }
}

EXAMPLE INPUT:

Previous file:
There is no previous file

Current file:
src/server/api/routers/users.ts
\`\`\`tsx
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, protectedProcedure, publicProcedure } from "../trpc";
import { hash } from "bcrypt";
import { db } from "@/server/db";
import { users } from "@/db/schema/users";
import { eq } from "drizzle-orm";

export const usersRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).optional().default(10),
        cursor: z.string().optional(),
      })
    )
    .output(
      z.object({
        items: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            email: z.string(),
            role: z.enum(["user", "admin"]),
          })
        ),
        nextCursor: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const limit = input.limit ?? 10;
      const { cursor } = input;

      const items = await db.query.users.findMany({
        limit: limit + 1,
        cursor: cursor ? { id: cursor } : undefined,
        orderBy: users.id,
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      let nextCursor: string | undefined = undefined;
      if (items.length > limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items,
        nextCursor,
      };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
        role: z.enum(["user", "admin"]),
      })
    )
    .query(async ({ input }) => {
      const { id } = input;

      const user = await db.query.users.findFirst({
        where: eq(users.id, id),
        columns: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No user with id '" + id + "'",
        });
      }

      return user;
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(3).max(50),
        email: z.string().email(),
        password: z.string().min(8).max(100),
      })
    )
    .output(
      z.object({
        id: z.string(),
        name: z.string(),
        email: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const { name, email, password } = input;

      const hashedPassword = await hash(password, 10);

      const existingUser = await db.query.users.findFirst({
        where: eq(users.email, email),
      });

      if (existingUser) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Email already in use",
        });
      }

      const [user] = await db.insert(users).values({
        name,
        email,
        password: hashedPassword,
      }).returning({
        id: users.id,
        name: users.name,
        email: users.email,
      });

      return user;
    }),
});
\`\`\`

EXAMPLE OUTPUT:
{
  "declarations": [
    {
      "type": "endpoint",
      "definition": {
        "subtype": "rpc",
        "name": "usersRouter.getAll",
        "description": "Get all users with pagination support",
        "parameters": {
          "type": "object",
          "properties": {
            "limit": {
              "type": "number",
              "description": "Maximum number of users to return",
              "minimum": 1,
              "maximum": 100,
              "default": 10
            },
            "cursor": {
              "type": "string",
              "description": "Cursor for pagination"
            }
          }
        },
        "returns": {
          "type": "object",
          "properties": {
            "items": {
              "type": "array",
              "items": {
                "type": "object",
                "properties": {
                  "id": {
                    "type": "string"
                  },
                  "name": {
                    "type": "string"
                  },
                  "email": {
                    "type": "string"
                  },
                  "role": {
                    "type": "string",
                    "enum": ["user", "admin"]
                  }
                }
              }
            },
            "nextCursor": {
              "type": "string"
            }
          },
          "required": ["items"]
        },
        "signature": "function getAll(input: { limit?: number, cursor?: string }): Promise<{ items: Array<{ id: string, name: string, email: string, role: 'user' | 'admin' }>, nextCursor?: string }>"
      },
      "protected": true,
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/server/api/trpc",
            "dependsOn": ["createTRPCRouter", "protectedProcedure"]
          },
          {
            "importPath": "/src/server/db",
            "dependsOn": ["db"]
          },
          {
            "importPath": "/src/db/schema/users",
            "dependsOn": ["users"]
          }
        ],
        "external": [
          {
            "name": "zod",
            "importPath": "zod",
            "dependsOn": ["z"]
          },
          {
            "name": "drizzle-orm",
            "importPath": "drizzle-orm",
            "dependsOn": ["eq"]
          }
        ]
      },
      "isNode": true
    },
    {
      "type": "endpoint",
      "definition": {
        "subtype": "rpc",
        "name": "usersRouter.getById",
        "description": "Get a user by their ID",
        "parameters": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string",
              "description": "The ID of the user to retrieve"
            }
          },
          "required": ["id"]
        },
        "returns": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "email": {
              "type": "string"
            },
            "role": {
              "type": "string",
              "enum": ["user", "admin"]
            }
          },
          "required": ["id", "name", "email", "role"]
        },
        "signature": "function getById(input: { id: string }): Promise<{ id: string, name: string, email: string, role: 'user' | 'admin' }>"
      },
      "protected": true,
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/server/api/trpc",
            "dependsOn": ["createTRPCRouter", "protectedProcedure"]
          },
          {
            "importPath": "/src/server/db",
            "dependsOn": ["db"]
          },
          {
            "importPath": "/src/db/schema/users",
            "dependsOn": ["users"]
          }
        ],
        "external": [
          {
            "name": "zod",
            "importPath": "zod",
            "dependsOn": ["z"]
          },
          {
            "name": "@trpc/server",
            "importPath": "@trpc/server",
            "dependsOn": ["TRPCError"]
          },
          {
            "name": "drizzle-orm",
            "importPath": "drizzle-orm",
            "dependsOn": ["eq"]
          }
        ]
      },
      "isNode": true,
    },
    {
      "type": "endpoint",
      "definition": {
        "subtype": "rpc",
        "name": "usersRouter.create",
        "description": "Create a new user account",
        "parameters": {
          "type": "object",
          "properties": {
            "name": {
              "type": "string",
              "description": "User's full name",
              "minLength": 3,
              "maxLength": 50
            },
            "email": {
              "type": "string",
              "description": "User's email address",
              "format": "email"
            },
            "password": {
              "type": "string",
              "description": "User's password",
              "minLength": 8,
              "maxLength": 100
            }
          },
          "required": ["name", "email", "password"]
        },
        "returns": {
          "type": "object",
          "properties": {
            "id": {
              "type": "string"
            },
            "name": {
              "type": "string"
            },
            "email": {
              "type": "string"
            }
          },
          "required": ["id", "name", "email"]
        },
        "signature": "function create(input: { name: string, email: string, password: string }): Promise<{ id: string, name: string, email: string }>"
      },
      "protected": false,
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/server/api/trpc",
            "dependsOn": ["createTRPCRouter", "publicProcedure"]
          },
          {
            "importPath": "/src/server/db",
            "dependsOn": ["db"]
          },
          {
            "importPath": "/src/db/schema/users",
            "dependsOn": ["users"]
          }
        ],
        "external": [
          {
            "name": "zod",
            "importPath": "zod",
            "dependsOn": ["z"]
          },
          {
            "name": "@trpc/server",
            "importPath": "@trpc/server",
            "dependsOn": ["TRPCError"]
          },
          {
            "name": "bcrypt",
            "importPath": "bcrypt",
            "dependsOn": ["hash"]
          },
          {
            "name": "drizzle-orm",
            "importPath": "drizzle-orm",
            "dependsOn": ["eq"]
          }
        ]
      },
      "isNode": true
    },
    {
      "type": "other",
      "name": "usersRouter",
      "description": "tRPC router for user-related operations",
      "dependencies": {
        "internal": [
          {
            "importPath": "/src/server/api/trpc",
            "dependsOn": ["createTRPCRouter", "protectedProcedure", "publicProcedure"]
          }
        ],
        "external": [
          {
            "name": "@trpc/server",
            "importPath": "@trpc/server",
            "dependsOn": ["TRPCError"]
          }
        ]
      },
      "isNode": false
    }
  ],
  "metadata": {
    "updatedDeclarations": [],
    "deletedDeclarations": []
  }
}

REMINDERS:
- MUST extract ONLY TOP-LEVEL declarations from the file, with the exception of RPC procedures which are defined in an router object.
- MUST follow EXACTLY the declaration schemas defined in the project's declaration specification system
- MUST for each declaration, determine the correct type (endpoint, function, model, component, other)
- MUST match the schema structure exactly to the requirements
- MUST classify the declaration as a node or non-node`;
