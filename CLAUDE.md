# Claude Code Configuration

This file contains configuration and context for Claude Code to help with development tasks.

## Project Overview
Weldr - A Turborepo monorepo with pnpm package manager for workflow automation platform with agent capabilities.

## Commands
- Type check: `pnpm run check-types`
- Lint and Format: `pnpm run check:fix`
- Clean: `pnpm run clean`

## Database Commands
- Generate: `pnpm db:generate`
- Migrate: `pnpm db:migrate`
- Push: `pnpm db:push`
- Studio: `pnpm db:studio`

## Project Structure
- Turborepo monorepo using pnpm workspaces

### Apps
- `apps/agent/` - Agent service with AI workflow capabilities
- `apps/web/` - Next.js web frontend application

### Packages
- `packages/api/` - tRPC API router and utilities (@weldr/api)
- `packages/auth/` - Authentication client (@weldr/auth)
- `packages/db/` - Database schema and utilities (@weldr/db)
- `packages/emails/` - Email templates (@weldr/emails)
- `packages/presets/` - Project presets and templates (@weldr/presets)
- `packages/shared/` - Shared types and utilities (@weldr/shared)
- `packages/ui/` - UI components library (@weldr/ui)

### Tooling
- `tooling/github/` - GitHub Actions setup
- `tooling/typescript/` - TypeScript configurations

## Development Notes
- Current branch: feat/agent-to-fly-migration
- Uses Biome for linting instead of ESLint
- TypeScript across all packages
- Database schema in packages/db/src/schema/