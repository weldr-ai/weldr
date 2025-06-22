# Weldr Monorepo - Claude Documentation

## Project Overview
Weldr is a comprehensive TypeScript monorepo for building AI-powered development tools and platforms. It combines intelligent AI agents, modern web interfaces, type-safe APIs, and comprehensive project templates to create a complete development platform.

## Architecture & Technology Stack

### Core Technologies
- **Language**: TypeScript 5.x with strict configuration
- **Package Manager**: pnpm v10.4.1 with workspaces
- **Build System**: Turbo for monorepo orchestration
- **Linting**: Biome (replaces ESLint/Prettier)
- **Git Workflow**: Conventional commits with Commitizen
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Better Auth with Stripe subscriptions
- **AI Integration**: Multiple providers (Anthropic, OpenAI, Google)

### Deployment & Infrastructure
- **Agent Deployment**: Docker + Fly.io
- **Web Deployment**: Next.js deployment ready
- **Storage**: AWS S3 for file operations
- **Caching**: Redis for sessions and data
- **Emails**: Resend for transactional emails

## Available Commands

### Development Commands
- `pnpm dev` - Start all development servers
- `pnpm build` - Build all packages and apps
- `pnpm start` - Start production servers
- `pnpm preview` - Preview production builds

### Quality Assurance
- `pnpm check-types` - Type check entire monorepo
- `pnpm check` - Run Biome linting
- `pnpm check:fix` - Fix linting issues automatically
- `pnpm clean` - Clean build artifacts
- `pnpm clean:ws` - Clean workspace dependencies

### Database Operations
- `pnpm db:generate` - Generate database schema
- `pnpm db:migrate` - Run database migrations
- `pnpm db:push` - Push schema changes to database
- `pnpm db:studio` - Open Drizzle Studio
- `pnpm db:seed` - Seed database with test data
- `pnpm db:up` - Start database container

### Git & Publishing
- `pnpm commit` - Interactive conventional commits
- `pnpm publish-packages` - Publish packages to registry
- `pnpm lint:staged` - Run linting on staged files

## Project Structure

### Applications (`/apps`)

#### Agent Service (`apps/agent/`)
**Purpose**: AI-powered development environment for autonomous coding
- **Tech Stack**: Hono + AI SDKs + Playwright
- **Key Features**: Command execution API, project generation, AI workflow orchestration
- **Dependencies**: Multiple AI providers, browser automation, file system operations
- **Entry Point**: `src/index.ts`

#### Web Platform (`apps/web/`)
**Purpose**: Next.js web application for the Weldr platform interface
- **Tech Stack**: Next.js 15 + tRPC + shadcn/ui + Tailwind
- **Key Features**: Project management, AI chat interfaces, visual editors
- **Dependencies**: React ecosystem, authentication, real-time updates
- **Entry Point**: `src/app/page.tsx`

### Packages (`/packages`)

#### API Layer (`packages/api/`)
**Purpose**: Type-safe tRPC API layer for client-server communication
- **Exports**: Router definitions, API utilities, type contracts
- **Key Features**: Input validation, error handling, authentication middleware
- **Dependencies**: tRPC, Zod validation, Redis caching

#### Authentication (`packages/auth/`)
**Purpose**: Better Auth integration with subscription management
- **Exports**: Auth configuration, client utilities, session management
- **Key Features**: User registration/login, password reset, Stripe subscriptions
- **Dependencies**: Better Auth, Stripe SDK, email integration

#### Database (`packages/db/`)
**Purpose**: Drizzle ORM with PostgreSQL schemas and utilities
- **Exports**: Database schemas, migration utilities, query helpers
- **Key Features**: Type-safe queries, automatic migrations, seeding
- **Dependencies**: Drizzle ORM, PostgreSQL driver, Zod integration

#### Email Templates (`packages/emails/`)
**Purpose**: React-based email templates for platform communications
- **Exports**: Email components, template utilities
- **Key Features**: Responsive design, authentication workflows, notifications
- **Dependencies**: React, Resend integration, email-safe styling

#### Project Presets (`packages/presets/`)
**Purpose**: Project templates and code generation utilities
- **Exports**: Template generator, boilerplate configurations
- **Key Features**: Multiple project types, Handlebars templating, dependency management
- **Dependencies**: Handlebars, file system operations, JSON schemas

#### Shared Utilities (`packages/shared/`)
**Purpose**: Common utilities, types, and validators across the monorepo
- **Exports**: Zod schemas, utility functions, type definitions, Fly.io configs
- **Key Features**: Type safety, validation, deployment utilities, ID generation
- **Dependencies**: Zod, nanoid, color utilities

#### UI Components (`packages/ui/`)
**Purpose**: Comprehensive component library based on shadcn/ui
- **Exports**: React components, hooks, icons, styling utilities
- **Key Features**: Accessible components, theme support, responsive design
- **Dependencies**: Radix UI, Tailwind CSS, Lucide icons

### Tooling (`/tooling`)

#### GitHub Actions (`tooling/github/`)
**Purpose**: CI/CD workflows and GitHub automation
- **Contents**: Action definitions, workflow templates

#### TypeScript Configuration (`tooling/typescript/`)
**Purpose**: Shared TypeScript configurations
- **Contents**: Base configs for different environments (Next.js, Node.js)

## Development Workflow

### Getting Started
1. **Prerequisites**: Node.js 20+, pnpm 10.4.1+
2. **Installation**: `pnpm install`
3. **Environment**: Copy `.env.example` to `.env` and configure
4. **Database**: `pnpm db:up && pnpm db:migrate`
5. **Development**: `pnpm dev`

### Package Development
- Each package has its own development commands
- Use workspace dependencies with `workspace:*` protocol
- Follow conventional commit format for all changes
- Run type checking before committing

### Testing Strategy
- Component testing in UI package
- API endpoint testing in API package
- End-to-end testing for critical user flows
- Type checking across entire monorepo

### Deployment Process
- Agent service: Docker containers on Fly.io
- Web application: Next.js deployment platform
- Database migrations: Automated through CI/CD
- Package publishing: Changesets for version management

## Key Features & Capabilities

### AI-Powered Development
- **Autonomous Coding**: Complete application generation from requirements
- **Intelligent Editing**: Context-aware code modifications
- **Multi-LLM Support**: Anthropic Claude, OpenAI GPT, Google Gemini
- **Workflow Orchestration**: Complex development task automation

### Modern Web Platform
- **Project Management**: Visual project creation and management
- **Real-time Collaboration**: Live editing and chat interfaces
- **Visual Editors**: Drag-and-drop interface builders
- **Responsive Design**: Mobile-first, accessible interfaces

### Type-Safe Architecture
- **End-to-end Type Safety**: From database to frontend
- **Runtime Validation**: Zod schemas throughout the stack
- **API Contracts**: tRPC for type-safe client-server communication
- **Database Operations**: Drizzle ORM with inferred types

### Enterprise Features
- **Authentication & Authorization**: Role-based access control
- **Subscription Management**: Stripe integration for billing
- **Email Workflows**: Transactional and notification emails
- **Audit Trails**: Comprehensive logging and monitoring

## Environment Configuration

### Required Environment Variables
```bash
# Database
DATABASE_URL=postgresql://...

# Authentication
AUTH_SECRET=...
STRIPE_SECRET_KEY=...

# AI Providers
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_AI_API_KEY=...

# Storage & Services
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
RESEND_API_KEY=...
REDIS_URL=...
```

### Development vs Production
- Development: Local PostgreSQL, file storage, mock services
- Production: Managed databases, cloud storage, production APIs
- Staging: Production-like environment for testing

## Performance & Scalability

### Database Optimization
- Proper indexing strategies for query performance
- Connection pooling for concurrent operations
- Migration strategies for schema changes
- Query optimization with Drizzle insights

### Frontend Performance
- Next.js optimizations (Image, Code splitting, SSG/SSR)
- Bundle size monitoring and optimization
- Component lazy loading and virtualization
- Caching strategies for API responses

### Backend Performance
- Redis caching for session and frequently accessed data
- AI provider request optimization and caching
- Background job processing for long-running tasks
- Horizontal scaling capabilities with Fly.io

## Security Considerations

### Authentication Security
- Secure session management with httpOnly cookies
- Password hashing with industry standards
- Multi-factor authentication support
- Session timeout and cleanup

### API Security
- Input validation and sanitization
- Rate limiting for API endpoints
- CORS configuration for cross-origin requests
- Authentication middleware for protected routes

### Infrastructure Security
- Environment variable management
- Secrets rotation and management
- Network security with Fly.io
- Database security and access control

## Troubleshooting & Support

### Common Issues
- **Build Failures**: Check TypeScript errors, dependency versions
- **Database Issues**: Verify connection strings, run migrations
- **Authentication Problems**: Check environment variables, session storage
- **AI Integration**: Verify API keys, check rate limits

### Debugging Tools
- Drizzle Studio for database inspection
- pnpm workspace utilities for dependency management
- Biome for code quality issues
- Browser dev tools for frontend debugging

### Getting Help
- Check package-specific CLAUDE.md files for detailed information
- Review .cursorrules files for development guidelines
- Use TypeScript compiler for type-related issues
- Consult package documentation and examples

## Future Roadmap
- Enhanced AI agent capabilities and reasoning
- Real-time collaborative editing features
- Advanced project template system
- Plugin architecture for extensibility
- Performance monitoring and analytics
- International localization support