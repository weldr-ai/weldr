# @weldr/api - tRPC API Layer

## Overview
The API package provides a type-safe tRPC API for the Weldr platform, serving as the communication layer between the frontend and backend. It's designed for full type safety, ensuring that the client and server are always in sync.

## Architecture & Technology Stack

### Core Technologies
- **tRPC**: End-to-end type-safe API framework
- **Zod**: Runtime validation and TypeScript type inference
- **Superjson**: Serialization for complex data types (dates, maps, etc.)
- **Redis**: Caching for performance-critical endpoints
- **Playwright**: Browser automation for tasks like screenshots
- **Database Integration**: Seamless connection to @weldr/db
- **Authentication**: Integration with @weldr/auth for protected routes

### Key Features
- **Type Safety**: Full end-to-end type safety with TypeScript inference
- **Input Validation**: Automatic request validation with Zod schemas
- **Error Handling**: Consistent error responses and status codes
- **Authentication Middleware**: Protected procedures for authenticated users
- **Modular Routers**: API organized by domain for maintainability
- **Caching Strategy**: Redis integration for high-performance queries
- **Dependency Injection**: Context-based access to database and services

## Project Structure

### Router Definitions (`src/router/`)
- `canvas-node.ts`: API for visual editor nodes
- `chats.ts`: Chat and AI interaction endpoints
- `declarations.ts`: Component and function declaration management
- `deployments.ts`: Project deployment status and history
- `projects.ts`: Project creation and management
- `users.ts`: User profile and settings management
- **Additional domain-specific routers...**

### Core Files
- `src/index.ts`: Main API router combining all sub-routers
- `src/init.ts`: tRPC initialization and context creation
- `src/utils.ts`: Utility functions specific to the API layer

## Available Commands

```bash
pnpm check-types  # Run TypeScript type checking
pnpm clean        # Clean build artifacts and node_modules
```

## API Design & Patterns

### tRPC Router Structure
- Routers are organized by feature/domain.
- Each router file exports a `router` object.
- The main `index.ts` file merges all routers into a single `appRouter`.

### Procedure (Endpoint) Pattern
```typescript
import { protectedProcedure, publicProcedure, router } from '../init';
import { z } from 'zod';

export const exampleRouter = router({
  // Public procedure (no authentication required)
  getPublicData: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // Access context: ctx.db, ctx.redis
      return { id: input.id, data: 'some public data' };
    }),

  // Protected procedure (authentication required)
  getPrivateData: protectedProcedure
    .input(z.object({ userId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Access session: ctx.session.user
      return { id: input.userId, data: 'some private data' };
    }),

  // Mutation (for creating, updating, or deleting data)
  updateData: protectedProcedure
    .input(z.object({ id: z.string(), newData: z.any() }))
    .mutation(async ({ input, ctx }) => {
      // Perform write operation
      return { success: true };
    }),
});
```

### Context (`Context`)
The tRPC context provides access to shared resources within procedures.
- `db`: Drizzle ORM instance from `@weldr/db`
- `session`: User session information from `@weldr/auth`
- `redis`: Redis client for caching
- `req`, `res`: HTTP request and response objects

### Input Validation
- All procedure inputs are validated with Zod schemas.
- Schemas are often defined in `@weldr/shared` for reuse.
- Validation errors are automatically handled by tRPC, returning a `BAD_REQUEST` error.

## Error Handling
- Use `TRPCError` for throwing expected errors from procedures.
- Utilize standard error codes (e.g., `UNAUTHORIZED`, `NOT_FOUND`, `INTERNAL_SERVER_ERROR`).
- Consistent error shapes are sent to the client for easy handling.

```typescript
import { TRPCError } from '@trpc/server';

// Example of throwing a tRPC error
if (!isAuthorized) {
  throw new TRPCError({
    code: 'UNAUTHORIZED',
    message: 'You are not authorized to perform this action.',
  });
}
```

## Integration with Other Packages

### Database (`@weldr/db`)
- The API layer uses `@weldr/db` for all database operations.
- Type-safe queries are built with Drizzle ORM.
- Database schemas and types are imported directly.

### Authentication (`@weldr/auth`)
- `protectedProcedure` middleware uses `@weldr/auth` to validate sessions.
- User session data is available in the tRPC context.
- API endpoints are protected based on user authentication state.

### Shared Utilities (`@weldr/shared`)
- Zod schemas for input validation are imported from `@weldr/shared`.
- Shared TypeScript types ensure consistency between packages.
- Utility functions are leveraged for common tasks.

## Caching Strategy
- Redis is used for caching frequently accessed data that doesn't change often.
- Cache keys are managed with a consistent naming convention.
- Cache invalidation logic is implemented in mutations to ensure data freshness.

## Development Guidelines

### Adding a New Router
1. Create a new file in `src/router/` (e.g., `newFeature.ts`).
2. Define the router using the standard pattern.
3. Add procedures for queries and mutations with Zod validation.
4. Import and merge the new router in `src/index.ts`.

### Best Practices
- Keep procedures focused on a single responsibility.
- Abstract complex business logic into utility functions.
- Use `protectedProcedure` by default unless data is explicitly public.
- Write JSDoc comments for all procedures to explain their purpose.

## Troubleshooting

### Common Issues
- **Type Errors**: Ensure client and server are using the same version of `@weldr/api`.
- **Authentication Errors**: Verify that the session is correctly passed in the context.
- **Validation Errors**: Check the Zod schema against the input data.
- **CORS Issues**: Ensure the frontend URL is correctly configured in the server's CORS policy.

### Debugging
- Use console logs within procedures to inspect input and context.
- Enable detailed logging in tRPC for network-level debugging.
- Check Redis to verify caching behavior.
- Inspect database state with Drizzle Studio.
