# @weldr/api

tRPC API router and utilities package.

## Overview
This package provides the main API layer using tRPC for type-safe API communication between the web frontend and backend services.

## Key Dependencies
- `@trpc/server` - tRPC server implementation
- `@weldr/auth` - Authentication utilities
- `@weldr/db` - Database schema and utilities
- `@weldr/shared` - Shared types and validators
- `playwright` - Browser automation for screenshots
- `redis` - Redis client for caching

## Commands
- Type check: `pnpm check-types`
- Clean: `pnpm clean`

## Structure
- `src/router/` - tRPC router definitions
- `src/utils.ts` - Utility functions