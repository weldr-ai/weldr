# Weldr Agent - Cursor Rules

## App Overview
The Weldr Agent is a development environment designed for AI agents to autonomously develop applications. It provides a command execution API and project boilerplates for AI-driven development workflows.

## Technology Stack
- **Runtime**: Node.js 20+ with TypeScript
- **Framework**: Hono for HTTP server
- **AI SDKs**: Anthropic, OpenAI, Google AI
- **Tools**: Playwright for browser automation
- **Deployment**: Docker + Fly.io ready
- **Storage**: AWS S3 for file storage

## Architecture Patterns

### API Design
- Use Hono with OpenAPI specification via `@hono/zod-openapi`
- Implement proper middleware for logging, auth, and error handling
- Use Zod for request/response validation
- Follow RESTful principles for endpoints

### AI Integration
- Use the `ai` SDK for LLM interactions
- Implement proper token usage tracking
- Handle AI provider rate limits gracefully
- Use streaming responses for long-running operations

### Command Execution
- Implement secure command execution with proper sandboxing
- Log all command executions for debugging
- Handle timeouts and process cleanup
- Sanitize input/output for security

## Code Organization

### Directory Structure
- `src/ai/` - AI-related functionality (agents, prompts, tools)
- `src/lib/` - Utility functions and configurations
- `src/routes/` - HTTP route handlers
- `src/workflow/` - Development workflow engine
- `src/middlewares/` - HTTP middleware

### AI Agents (`src/ai/agents/`)
- Keep agent logic modular and testable
- Use proper TypeScript types for agent configs
- Implement proper error handling for AI operations
- Use structured prompts and tool definitions

### Tools (`src/ai/tools/`)
- Create reusable tools for common development tasks
- Follow the established tool interface pattern
- Implement proper validation and error handling
- Document tool capabilities and limitations

## Development Guidelines

### Security Considerations
- Never execute arbitrary user code without sandboxing
- Validate all inputs from external sources
- Use environment variables for sensitive configuration
- Implement proper authentication for API access

### Error Handling
- Use structured error responses with proper HTTP status codes
- Log errors with sufficient context for debugging
- Handle AI provider errors gracefully
- Implement retry mechanisms for transient failures

### Performance
- Stream responses for long-running operations
- Implement proper timeout handling
- Use connection pooling for database operations
- Monitor resource usage during development

### Boilerplates (`data/boilerplates/`)
- Keep boilerplates minimal but functional
- Use consistent project structure across templates
- Include proper TypeScript configurations
- Provide clear setup instructions

## AI Assistant Guidelines
When working on the agent app:
- Prioritize security in all command execution features
- Test AI integrations thoroughly with different providers
- Use proper streaming for real-time feedback
- Implement comprehensive logging for debugging
- Consider the autonomous nature of AI agent usage
- Follow the established workflow patterns
- Use proper TypeScript types for all AI interactions
