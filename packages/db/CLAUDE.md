# @weldr/db - Database Layer

## Overview
The Database package is the source of truth for all data in the Weldr platform. It uses Drizzle ORM to provide a type-safe, efficient, and maintainable way to interact with the PostgreSQL database.

## Architecture & Technology Stack

### Core Technologies
- **ORM**: Drizzle ORM for type-safe SQL queries
- **Database**: PostgreSQL
- **Migrations**: Drizzle Kit for schema migrations
- **Schema Validation**: `drizzle-zod` for generating Zod schemas from database schemas
- **TypeScript**: Full type safety from database to application layer

### Key Features
- **Type-Safe Queries**: All database queries are fully typed, preventing common runtime errors.
- **Schema as Code**: Database schemas are defined in TypeScript, making them version-controllable.
- **Automated Migrations**: Drizzle Kit generates SQL migration files from schema changes.
- **Zod Integration**: Automatically generate Zod schemas for runtime validation.
- **Performance**: Drizzle is a lightweight ORM that produces efficient SQL queries.

## Project Structure

### Schema Definitions (`src/schema/`)
- Schemas are organized by domain into separate files (e.g., `auth.ts`, `projects.ts`).
- Each file defines tables, relationships, and exports inferred TypeScript types.
- An `index.ts` file exports all schemas and types for easy consumption.

**Example Schema (`users.ts`)**
```typescript
import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Inferred types for type-safe usage
export type User = typeof users.$inferSelect; // for selecting
export type NewUser = typeof users.$inferInsert; // for inserting
```

### Migrations (`drizzle/`)
- This directory is automatically managed by Drizzle Kit.
- It contains all the generated SQL migration files.
- `meta/_journal.json` tracks which migrations have been applied.

### Core Files
- `src/index.ts`: Exports the Drizzle client instance and all schemas.
- `src/config.ts`: Configuration for Drizzle Kit (e.g., database connection string).
- `src/utils.ts`: Utility functions for the database layer.
- `scripts/seed.ts`: Script for seeding the database with initial data.

## Available Commands

```bash
# Schema & Migrations
pnpm db:generate   # Generate SQL migrations from schema changes
pnpm db:migrate    # Apply pending migrations to the database
pnpm db:push       # Push schema changes directly (for development)
pnpm db:check      # Check if the database is in sync with the schema

# Database Introspection
pnpm db:pull       # Pull schema from an existing database
pnpm db:drop       # Drop the database (DANGER!)

# Database Management
pnpm db:studio     # Open Drizzle Studio to browse data
pnpm db:seed       # Run the seed script
pnpm db:up         # Start the database container (if using Docker)
```

## Database Schema Design

### Core Tables
- `users`: Stores user account information.
- `accounts`: Handles social logins and multi-provider authentication.
- `sessions`: Stores active user sessions.
- `projects`: Contains information about user-created projects.
- `canvasNodes`: Stores nodes for the visual editor.
- `subscriptions`: Manages user subscription status from Stripe.
- **And other domain-specific tables...**

### Relationships
- Foreign keys are used to enforce referential integrity.
- Drizzle's `relations` helper is used to define relationships for querying.
- One-to-one, one-to-many, and many-to-many relationships are all supported.

## Development Workflow

### Making Schema Changes
1.  **Modify Schema**: Edit a schema file in `src/schema/`.
2.  **Generate Migration**: Run `pnpm db:generate`. This creates a new SQL file in the `drizzle/` directory.
3.  **Review Migration**: Inspect the generated SQL file to ensure it's correct.
4.  **Apply Migration**: Run `pnpm db:migrate` to apply the changes to your local database.
5.  **Commit**: Commit both the schema changes and the generated migration file.

### Querying the Database
- Import the Drizzle instance and necessary schemas from `@weldr/db`.
- Use Drizzle's query builder to construct type-safe queries.

```typescript
import { db } from '@weldr/db';
import { users } from '@weldr/db/schema';
import { eq } from 'drizzle-orm';

async function getUser(userId: string) {
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });
  return user;
}
```

## Integration with Other Packages

- **`@weldr/api`**: The API layer is the primary consumer, using this package for all data operations.
- **`@weldr/auth`**: Uses the database to store user and session information.
- **`@weldr/shared`**: `drizzle-zod` can be used to generate Zod schemas in the shared package for reuse across the monorepo.

## Seeding
- The `scripts/seed.ts` file is used to populate the database with initial data for development.
- Run `pnpm db:seed` to execute it.
- This is useful for creating a consistent development environment.

## Environment Variables
- `DATABASE_URL`: The connection string for the PostgreSQL database. This is the only required environment variable for this package.
  - Example: `DATABASE_URL="postgresql://user:password@localhost:5432/weldr"`
