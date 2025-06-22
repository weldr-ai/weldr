# @weldr/shared - Shared Utilities & Types

## Overview
The Shared package is the foundational layer of the Weldr monorepo. It contains common utilities, TypeScript types, Zod validators, and configurations that are used across multiple packages and applications. Its purpose is to promote code reuse, consistency, and type safety.

## Architecture & Technology Stack

### Core Technologies
- **Type Safety**: TypeScript for all type definitions
- **Validation**: Zod for runtime data validation and schema definition
- **ID Generation**: Nanoid for generating unique, URL-friendly IDs
- **Deployment**: Utilities for configuring and deploying to Fly.io
- **Utilities**: General-purpose helper functions (e.g., color manipulation)

### Key Features
- **Centralized Types**: A single source of truth for shared data structures.
- **Reusable Validators**: Zod schemas that can be used for API validation, form handling, and database schema generation.
- **Branded Types**: Enhanced type safety for primitive types like IDs.
- **Consistent Utilities**: A common library for functions used throughout the platform.
- **Deployment Configurations**: Centralized logic for Fly.io deployments.

## Project Structure

### Validators (`src/validators/`)
- This is one of the most critical parts of the shared package.
- Zod schemas are organized by domain (e.g., `auth.ts`, `projects.ts`).
- Each file exports both the Zod schema and the inferred TypeScript type.

**Example Validator (`auth.ts`)**
```typescript
import { z } from 'zod';

// Zod schema for login credentials
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// Inferred TypeScript type
export type LoginInput = z.infer<typeof loginSchema>;
```
This pattern allows the schema to be used for validation in the API layer while the type is used for props in the frontend.

### Types (`src/types/`)
- Contains shared TypeScript interfaces and types that are not derived from Zod schemas.
- Includes `Branded` types for creating distinct types from primitives.

**Example Branded Type**
```typescript
export type ProjectId = string & { readonly __brand: 'ProjectId' };
export type UserId = string & { readonly __brand: 'UserId' };

// This prevents accidentally using a UserId where a ProjectId is expected.
```

### Fly.io Utilities (`src/fly/`)
- Contains helpers and configurations for deploying applications to Fly.io.
- `app.ts`, `config.ts`, etc., help generate `fly.toml` files programmatically.

### Root Utilities (`src/`)
- `nanoid.ts`: Utility for generating unique IDs.
- `color-utils.ts`: Functions for color manipulation.
- `ofetch-config.ts`: Configuration for the `ofetch` HTTP client.

## Available Commands

```bash
pnpm check-types  # Run TypeScript type checking
pnpm clean        # Clean build artifacts
```

## How It's Used

This package is a dependency for almost every other package in the monorepo.

- **`@weldr/api`**: Imports Zod schemas from `src/validators/` to validate API inputs.
- **`@weldr/web`**: Imports TypeScript types from `src/validators/` and `src/types/` for component props and state. It also uses Zod schemas for client-side form validation.
- **`@weldr/db`**: The database schemas in `@weldr/db` are often designed to be compatible with the Zod schemas defined here. `drizzle-zod` can be used to bridge this gap.
- **`@weldr/agent`**: Uses deployment utilities from `src/fly/` to configure and deploy generated applications.

## Development Guidelines

### Adding New Shared Code
- **Is it truly shared?**: Before adding code here, ensure it's needed by at least two other packages.
- **Where does it go?**:
  - If it's a data structure with validation rules, add it to `src/validators/`.
  - If it's just a type definition, add it to `src/types/`.
  - If it's a reusable function, add it to the root or a new utility file.
- **Keep it generic**: Utilities in this package should be application-agnostic.
- **No external dependencies if possible**: Avoid adding new dependencies to this package unless absolutely necessary to keep it lightweight.

### Best Practices
- **Export types and schemas**: Always export both the Zod schema and its inferred type.
- **Use branded types**: For IDs and other specific string/number values, use branded types to improve type safety.
- **Document everything**: Use JSDoc to explain the purpose of types, schemas, and utility functions.
- **Keep it clean**: This package is the foundation. It should be the most stable and well-maintained part of the monorepo.
