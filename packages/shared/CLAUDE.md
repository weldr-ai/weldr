# @weldr/shared

Shared types, utilities, and validators package.

## Overview
This package contains shared code used across multiple packages including types, utilities, validators, and integrations.

## Key Dependencies
- `zod` - Schema validation
- `nanoid` - ID generation
- `ofetch` - HTTP client
- `@aws-sdk/client-s3` - AWS S3 integration

## Exports
- `.` - Main exports
- `./utils` - Utility functions
- `./validators/*` - Zod validators
- `./types` - TypeScript types
- `./fly` - Fly.io integration
- `./tigris` - Tigris storage
- `./redis` - Redis utilities
- `./nanoid` - ID generation
- `./color-utils` - Color utilities

## Commands
- Type check: `pnpm check-types`
- Clean: `pnpm clean`

## Features
- Shared TypeScript types
- Zod validation schemas
- Fly.io deployment utilities
- AWS S3 integration
- Redis configuration
- Color manipulation utilities
- HTTP client configuration