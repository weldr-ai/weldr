# @weldr/db

Database schema and utilities package using Drizzle ORM.

## Overview
This package manages the database schema, migrations, and provides utilities for database operations using Drizzle ORM with PostgreSQL.

## Key Dependencies
- `drizzle-orm` - TypeScript ORM
- `drizzle-kit` - Database toolkit
- `pg` - PostgreSQL client
- `@weldr/shared` - Shared types and utilities

## Exports
- `.` - Main database client
- `./schema` - Database schema definitions
- `./utils` - Database utilities

## Commands
- Check: `pnpm check`
- Generate: `pnpm generate`
- Migrate: `pnpm migrate`
- Push: `pnpm push`
- Studio: `pnpm studio`
- Seed: `pnpm seed`

## Schema Files
- `auth.ts` - Authentication tables
- `projects.ts` - Project management
- `integrations.ts` - Third-party integrations
- `workflows.ts` - Workflow definitions
- `chats.ts` - Chat/messaging
- `canvas-nodes.ts` - Visual flow builder
- `themes.ts` - UI theming