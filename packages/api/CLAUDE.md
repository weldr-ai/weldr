# @weldr/api - Cursor Rules

## Package Overview
The API package provides a type-safe tRPC API layer for the Weldr platform. It handles all server-side business logic, data validation, and communication between the frontend and backend systems.

## Technology Stack
- **tRPC**: Type-safe API framework
- **Zod**: Runtime validation and TypeScript inference
- **Superjson**: Serialization for complex data types
- **Redis**: Caching and session storage
- **Playwright**: Browser automation for certain operations
- **Database**: Integration with @weldr/db (Drizzle ORM)

## Architecture Patterns

### tRPC Router Structure
- Organize routers by domain (chats, canvas-node, declarations, etc.)
- Use proper input/output validation with Zod
- Implement consistent error handling across all procedures
- Use middleware for common functionality (auth, logging, rate limiting)

### Validation Strategy
- Define Zod schemas in @weldr/shared for reuse
- Validate all inputs at the API boundary
- Use proper TypeScript inference from Zod schemas
- Implement custom error messages for validation failures

### Error Handling
- Use tRPC error codes consistently (BAD_REQUEST, UNAUTHORIZED, etc.)
- Provide meaningful error messages for client consumption
- Log errors appropriately for debugging
- Handle database errors gracefully

## Code Organization

### Router Files (`src/router/`)
- Keep each router focused on a single domain
- Use consistent naming conventions
- Export router and its types properly
- Implement proper JSDoc documentation

### Procedures Pattern
```typescript
// Query pattern
.query('getName', {
  input: z.object({ id: z.string() }),
  output: z.object({ name: z.string() }),
  async resolve({ input, ctx }) {
    // Implementation
  }
})

// Mutation pattern
.mutation('updateName', {
  input: z.object({ id: z.string(), name: z.string() }),
  output: z.object({ success: z.boolean() }),
  async resolve({ input, ctx }) {
    // Implementation
  }
})
```

### Context Management
- Keep context lean and focused
- Include authentication state
- Provide database access through context
- Include request metadata when needed

## Development Guidelines

### Authentication & Authorization
- Use middleware for authentication checks
- Implement role-based access control where needed
- Validate user permissions for data access
- Handle unauthenticated requests gracefully

### Database Integration
- Use transactions for multi-step operations
- Implement proper error handling for database failures
- Use database indexes effectively for performance
- Consider data consistency requirements

### Caching Strategy
- Use Redis for session and frequently accessed data
- Implement cache invalidation strategies
- Consider cache warming for performance-critical data
- Use proper TTL values for different data types

### Performance Considerations
- Implement pagination for list endpoints
- Use database projections to limit data transfer
- Consider N+1 query problems and use proper joins
- Profile and optimize slow queries

## API Design Guidelines

### Input Validation
- Validate all inputs with Zod schemas
- Use strict validation by default
- Provide clear error messages for validation failures
- Consider input sanitization for security

### Output Formatting
- Use consistent response structures
- Include metadata (pagination, timestamps) when appropriate
- Consider GraphQL-style field selection for large objects
- Implement proper null/undefined handling

### Versioning Strategy
- Use semantic versioning for breaking changes
- Maintain backward compatibility when possible
- Document API changes thoroughly
- Consider deprecation warnings for old endpoints

## Integration Guidelines

### Database (@weldr/db)
- Use proper TypeScript types from database schemas
- Implement repository patterns for complex queries
- Use database migrations for schema changes
- Handle foreign key constraints properly

### Authentication (@weldr/auth)
- Integrate with Better Auth session management
- Validate user tokens and sessions
- Handle authentication state properly
- Implement proper logout and session cleanup

### Shared Types (@weldr/shared)
- Use shared validators and types
- Keep API contracts in sync with frontend
- Export proper TypeScript types
- Use branded types for IDs when appropriate

## AI Assistant Guidelines
When working on the API package:
- Always validate inputs with Zod schemas
- Use proper tRPC error handling and status codes
- Implement type-safe database queries
- Consider authentication and authorization requirements
- Use consistent patterns across all routers
- Write comprehensive JSDoc for public APIs
- Test error scenarios thoroughly
- Consider performance implications of new endpoints
- Keep the API contract stable and well-documented
