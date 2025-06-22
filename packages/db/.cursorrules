# @weldr/db - Cursor Rules

## Package Overview
The Database package provides type-safe database operations using Drizzle ORM with PostgreSQL. It includes schema definitions, migrations, utilities, and seeding functionality for the Weldr platform.

## Technology Stack
- **Drizzle ORM**: Type-safe database operations
- **PostgreSQL**: Primary database
- **Drizzle Kit**: Database migrations and introspection
- **Zod**: Runtime validation with drizzle-zod integration
- **TypeScript**: Full type safety for database operations

## Architecture Patterns

### Schema Organization
- Organize schemas by domain in `src/schema/` directory
- Use consistent naming conventions for tables and columns
- Implement proper relationships between tables
- Use proper PostgreSQL data types

### Migration Strategy
- Use Drizzle Kit for all database schema changes
- Generate migrations for all schema changes
- Review generated migrations before applying
- Use descriptive migration names

### Type Safety
- Export proper TypeScript types from schemas
- Use Drizzle's type inference for queries
- Implement proper validation with drizzle-zod
- Use branded types for IDs when appropriate

## Code Organization

### Schema Files (`src/schema/`)
- One file per domain (auth.ts, chats.ts, etc.)
- Export schema tables and related types
- Implement proper foreign key relationships
- Use consistent column naming conventions

### Schema Patterns
```typescript
// Table definition pattern
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Type exports
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
```

### Index Strategy
- Create indexes for frequently queried columns
- Use composite indexes for complex queries
- Monitor query performance and add indexes as needed
- Consider unique constraints for business rules

## Development Guidelines

### Schema Design
- Use proper normalization principles
- Implement referential integrity with foreign keys
- Use appropriate data types for each column
- Consider future scalability in design decisions

### Query Optimization
- Use proper joins instead of N+1 queries
- Implement pagination for large result sets
- Use database projections to limit data transfer
- Monitor slow queries and optimize as needed

### Transaction Management
- Use transactions for multi-table operations
- Implement proper error handling in transactions
- Consider isolation levels for concurrent operations
- Handle deadlocks and retry logic when appropriate

### Data Validation
- Use Zod schemas for runtime validation
- Validate data at the application layer
- Implement proper constraints at the database level
- Handle validation errors gracefully

## Migration Guidelines

### Creating Migrations
- Always generate migrations using `pnpm generate`
- Review generated SQL before applying
- Test migrations on development data
- Consider rollback strategies for complex migrations

### Schema Changes
- Use additive changes when possible
- Handle breaking changes with proper versioning
- Document significant schema changes
- Consider impact on existing data

### Data Migrations
- Separate schema migrations from data migrations
- Use proper backup strategies for data changes
- Test data migrations thoroughly
- Handle large datasets with batching

## Configuration

### Database Connection
- Use connection pooling for performance
- Configure proper timeouts and retry logic
- Handle connection failures gracefully
- Monitor connection usage

### Environment Management
- Use proper environment variables for configuration
- Support multiple database environments
- Implement proper secret management
- Document all configuration options

## Integration Guidelines

### Application Integration
- Export clean interfaces for application use
- Provide repository patterns for complex operations
- Handle database errors appropriately
- Use proper TypeScript types throughout

### Seeding and Testing
- Provide seed data for development
- Use factories for test data generation
- Clean up test data properly
- Support database reset for testing

## Performance Guidelines

### Query Performance
- Use EXPLAIN ANALYZE for slow queries
- Implement proper indexing strategies
- Consider materialized views for complex aggregations
- Monitor database performance metrics

### Connection Management
- Use connection pooling effectively
- Handle connection leaks
- Monitor active connections
- Implement proper connection cleanup

## AI Assistant Guidelines
When working on the database package:
- Always use Drizzle ORM patterns and type safety
- Generate migrations for all schema changes
- Use proper PostgreSQL data types and constraints
- Implement proper foreign key relationships
- Consider query performance implications
- Use transactions for multi-step operations
- Export proper TypeScript types from schemas
- Follow consistent naming conventions
- Document complex queries and business logic
- Test database operations thoroughly
- Handle database errors gracefully
