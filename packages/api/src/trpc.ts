/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1)
 * 2. You want to create a new middleware or type of procedure (see Part 3)
 *
 * tl;dr - this is where all the tRPC server stuff is created and plugged in.
 * The pieces you will need to use are documented accordingly near the end
 */
import { TRPCError, initTRPC } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";

import type { Session } from "@integramind/auth";
import { auth } from "@integramind/auth";
import { db } from "@integramind/db";
import type { inferProcedureOutput } from "@trpc/server";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext: (opts: {
  headers: Headers;
}) => Promise<{
  session: Session | null;
  db: typeof db;
}> = async (opts) => {
  const session = await auth.api.getSession({ headers: opts.headers });
  return {
    session,
    db,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the trpc api is initialized, connecting the context and
 * transformer
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter: ({ shape, error }) => ({
    ...shape,
    data: {
      ...shape.data,
      zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
    },
  }),
});

/**
 * Create a server-side caller
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these
 * a lot in the /src/server/api/routers folder
 */

/**
 * This is how you create new routers and subrouters in your tRPC API
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Public (unauthed) procedure
 *
 * This is the base piece you use to build new queries and mutations on your
 * tRPC API. It does not guarantee that a user querying is authorized, but you
 * can still access user session data if they are logged in
 */
export const publicProcedure = t.procedure;

/**
 * Protected (authenticated) procedure
 *
 * If you want a query or mutation to ONLY be accessible to logged in users, use this. It verifies
 * the session is valid and guarantees `ctx.session.user` is not null.
 *
 * @see https://trpc.io/docs/procedures
 */

// Type for objects that might contain sensitive data
type SensitiveData = {
  code?: string;
  documentation?: string;
  content?: string;
};

// Type guard to check if an object contains sensitive data
const hasSensitiveData = (obj: unknown): obj is SensitiveData => {
  if (!obj || typeof obj !== "object") return false;
  return "code" in obj || "documentation" in obj || "content" in obj;
};

// Type-safe sanitize function
const sanitizeData = <T>(obj: T, seen = new WeakSet()): T => {
  if (!obj || typeof obj !== "object") return obj;
  if (seen.has(obj as object)) return obj;
  if (obj instanceof Date) return obj;
  seen.add(obj as object);

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeData(item, seen)) as T;
  }

  if (hasSensitiveData(obj)) {
    const clean = { ...obj };
    if ("code" in clean) clean.code = undefined;
    if ("documentation" in clean) clean.documentation = undefined;
    if ("content" in clean) clean.content = undefined;
    return clean as T;
  }

  const clean = { ...obj };
  for (const key in clean) {
    if (Object.prototype.hasOwnProperty.call(clean, key)) {
      clean[key] = sanitizeData(clean[key], seen);
    }
  }

  return clean as T;
};

// Middleware that sanitizes the response
const sanitize = t.middleware(async ({ ctx, next }) => {
  const result = await next();
  return sanitizeData(result);
});

// Protected procedure that includes auth and sanitization
export const protectedProcedure = t.procedure
  .use(async ({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "You must be logged in to access this resource",
      });
    }
    return next({
      ctx: {
        ...ctx,
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  })
  .use(sanitize);

export type ProtectedProcedureOutput<
  TProcedure extends (...args: unknown[]) => Promise<unknown>,
> = inferProcedureOutput<TProcedure>;
