# Weldr Monorepo - Agent Guidelines

## Commands

- **Build**: `pnpm build` (turbo build all packages)
- **Type Check**: `pnpm check-types` (turbo check-types)
- **Lint/Format**: `pnpm check:fix` (biome check --write)
- **Dev**: `pnpm dev` (turbo dev)
- **Test**: No global test command - only `apps/agent` has vitest
- **Database**: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:studio`

## Code Style

- **TypeScript**: Strict mode, NEVER use `any`, prefer functions over classes
- **Imports**: External libs → internal packages (`workspace:*`) → relative imports
- **Formatting**: Biome (space indentation, organized imports, sorted classes)
- **Exports**: Prefer named exports over default exports
- **Error Handling**: Use Result types or proper Error classes, avoid throwing in libraries

## Architecture

- **Monorepo**: pnpm + turbo, apps (`agent`, `web`) + packages (`api`, `auth`, `db`, `emails`, `presets`, `shared`, `ui`)
- **Database**: Drizzle ORM with PostgreSQL
- **API**: tRPC with Zod validation
- **UI**: shadcn/ui + Tailwind CSS
- **Auth**: Better Auth with Stripe integration

## Development

- Use appropriate package for new features
- Follow established patterns in each package
- Run `pnpm check:fix` before committing
