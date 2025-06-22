# @weldr/shared - Cursor Rules

## Package Overview
The Shared package provides common utilities, types, validators, and configurations used across the Weldr monorepo. It serves as the foundation for type safety and consistency across all packages and applications.

## Technology Stack
- **TypeScript**: Full type safety and utility types
- **Zod**: Runtime validation and schema definition
- **Fly.io**: Deployment configuration utilities
- **Nanoid**: ID generation utilities
- **Color utilities**: Color manipulation functions

## Architecture Patterns

### Type Organization
- Export types from `src/types/index.ts`
- Use branded types for IDs and special values
- Implement proper type guards and utilities
- Create utility types for common patterns

### Validation Strategy
- Use Zod for all runtime validation
- Export schemas and inferred types together
- Implement proper error messages
- Create reusable validation utilities

### Utility Functions
- Keep utilities pure and side-effect free
- Implement proper TypeScript types
- Use consistent error handling patterns
- Document complex utility functions

## Code Organization

### Directory Structure
- `src/types/` - TypeScript type definitions
- `src/validators/` - Zod schemas and validation
- `src/fly/` - Fly.io deployment utilities
- `src/` - Root level utilities (nanoid, color-utils, etc.)

### Validator Organization (`src/validators/`)
- Organize by domain (auth, chats, canvas-node, etc.)
- Export both schemas and inferred types
- Use consistent naming conventions
- Implement proper validation error messages

### Type Definitions (`src/types/`)
- Define shared interfaces and types
- Use utility types for transformations
- Implement branded types for type safety
- Export proper type guards

## Development Guidelines

### Type Safety
- Use strict TypeScript configuration
- Implement proper type guards
- Use branded types for IDs and special values
- Avoid `any` types completely

### Validation Patterns
```typescript
// Schema definition pattern
export const userSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  name: z.string().optional(),
});

export type User = z.infer<typeof userSchema>;
```

### Utility Development
- Keep functions pure and predictable
- Implement proper error handling
- Use meaningful function and parameter names
- Add JSDoc documentation for public APIs

### Error Handling
- Use Result types or proper Error classes
- Avoid throwing errors in utility functions
- Provide meaningful error messages
- Implement proper error types

## Validator Guidelines

### Schema Design
- Use descriptive schema names
- Implement proper validation rules
- Add custom error messages where needed
- Consider performance implications

### Domain Validation
- Group related schemas by domain
- Export schemas and types together
- Use consistent validation patterns
- Implement proper composition and reuse

### Runtime Validation
- Validate data at API boundaries
- Use proper error handling for validation failures
- Implement helpful error messages
- Consider validation performance

## Utility Guidelines

### Color Utilities
- Provide consistent color manipulation functions
- Support multiple color formats
- Implement proper type safety
- Handle edge cases gracefully

### ID Generation
- Use consistent ID generation patterns
- Provide typed ID functions
- Support different ID formats when needed
- Implement proper uniqueness guarantees

### Configuration Utilities
- Provide typed configuration helpers
- Support environment-specific configurations
- Implement proper validation for configs
- Handle missing or invalid configurations

## Integration Guidelines

### Cross-Package Usage
- Keep dependencies minimal
- Export clean interfaces
- Use proper TypeScript types
- Document breaking changes

### API Integration
- Provide validators for API contracts
- Export types for request/response objects
- Implement proper error handling
- Support API versioning when needed

### Database Integration
- Provide schemas for database validation
- Export types for database operations
- Implement proper transformation utilities
- Support migration helpers when needed

## Deployment Guidelines

### Fly.io Integration
- Provide deployment configuration utilities
- Support environment-specific configurations
- Implement proper secret management
- Handle deployment automation

### Configuration Management
- Use proper environment variable handling
- Implement configuration validation
- Support multiple environments
- Provide clear configuration documentation

## Performance Guidelines

### Bundle Size
- Keep the package lean and focused
- Avoid heavy dependencies
- Use tree-shaking friendly exports
- Monitor bundle impact on consuming packages

### Runtime Performance
- Optimize validation performance for hot paths
- Use efficient utility implementations
- Consider caching for expensive operations
- Profile and optimize when necessary

## AI Assistant Guidelines
When working on the shared package:
- Use strict TypeScript types throughout
- Create reusable Zod schemas with proper validation
- Keep utilities pure and side-effect free
- Export clean interfaces for cross-package usage
- Implement proper error handling patterns
- Use branded types for type safety
- Document public APIs with JSDoc
- Consider performance implications of utilities
- Test utility functions thoroughly
- Maintain backward compatibility when possible
- Use consistent naming conventions across utilities
