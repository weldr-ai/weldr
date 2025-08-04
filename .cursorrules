# Weldr Monorepo - Cursor Rules

## Project Overview
This is Weldr, a TypeScript monorepo for building AI-powered development tools and platforms. The project includes AI agents, web interfaces, APIs, and supporting packages.

## Technology Stack
- **Language**: TypeScript 5.x
- **Package Manager**: pnpm (v10.4.1)
- **Build System**: Turbo
- **Linting**: Biome
- **Git**: Conventional commits with commitizen
- **Architecture**: Modular monorepo with apps and packages

## Code Standards

### TypeScript
- Use strict TypeScript configuration
- Prefer type-safe approaches over `any`
- Use proper type definitions for all functions and components
- Leverage TypeScript's utility types when appropriate
- Export types from dedicated files when shared across packages
- Prefer functions over classes

### Code Style
- Use Biome for linting and formatting (configured in biome.json)
- Follow conventional commit format
- Use descriptive variable and function names
- Prefer functional programming patterns where appropriate
- **NEVER use `any` type** - always provide proper TypeScript types
- **ALWAYS follow Biome linting rules** - fix all linting errors immediately
- Template literals are preferred over string concatenation

### Import/Export Patterns
- Use workspace protocol for internal packages (`workspace:*`)
- Organize imports: external libraries, internal packages, relative imports
- Use barrel exports in package index files
- Prefer named exports over default exports

### Error Handling
- Use type-safe error handling with Result types or proper Error classes
- Avoid throwing errors in library code, return error objects instead
- Use Zod for runtime validation with proper error messages

## Monorepo Structure

### Apps (`/apps`)
- `agent`: AI development environment with command execution API
- `web`: Next.js web application for the platform

### Packages (`/packages`)
- `api`: tRPC API layer with type-safe endpoints
- `auth`: Better Auth integration with Stripe subscriptions
- `db`: Drizzle ORM with PostgreSQL schemas
- `emails`: React email templates with Resend
- `presets`: Project templates and code generation
- `shared`: Shared utilities, types, and configurations
- `ui`: shadcn/ui based component library

## Development Guidelines

### Adding New Features
1. Determine which package/app the feature belongs to
2. Create types in appropriate schema files
3. Implement with proper error handling
4. Add tests where applicable
5. Update documentation

### Cross-Package Dependencies
- Minimize dependencies between packages
- Use the `shared` package for common utilities
- Keep API interfaces stable to avoid breaking changes
- Version packages appropriately when making breaking changes

### Performance Considerations
- Use lazy loading for heavy components
- Implement proper caching strategies
- Optimize database queries with proper indexing
- Consider bundle size when adding dependencies

## Available Commands

### Commands
- Type check: `pnpm run typecheck`
- Lint and Format: `pnpm run check:fix`
- Clean: `pnpm run clean`

### Database Commands
- Generate: `pnpm db:generate`
- Migrate: `pnpm db:migrate`
- Push: `pnpm db:push`
- Studio: `pnpm db:studio`

## Package-Specific Notes

### Database (`@weldr/db`)
- Use Drizzle ORM for all database operations
- Define schemas in separate files by domain
- Use proper TypeScript types generated from schemas
- Run migrations before deploying

### UI (`@weldr/ui`)
- Build on top of shadcn/ui and Radix primitives
- Use Tailwind CSS for styling
- Ensure components are accessible
- Export components with proper TypeScript types

### API (`@weldr/api`)
- Use tRPC for type-safe API endpoints
- Implement proper validation with Zod
- Use proper error handling and status codes

## AI Assistant Guidelines
When working on this codebase:
- Understand the monorepo structure before making changes
- Use the appropriate package for new functionality
- Follow the established patterns in each package
- Consider cross-package implications of changes
- Write type-safe, well-documented code
- Use the established tooling (turbo, pnpm, biome)
