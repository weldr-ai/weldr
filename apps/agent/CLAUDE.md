# @weldr/agent - AI Development Environment

## Overview
The Weldr Agent is an AI-powered development environment designed for autonomous application development. It provides intelligent coding agents that can understand requirements, write code, manage projects, and orchestrate complex development workflows without human intervention.

## Architecture & Core Features

### AI Agent Capabilities
- **Autonomous Code Generation**: Creates complete applications from natural language requirements
- **Intelligent Code Editing**: Performs context-aware modifications to existing codebases
- **Project Scaffolding**: Generates full-stack applications with proper architecture
- **Dependency Management**: Automatically installs and configures required packages
- **Integration Setup**: Configures databases, APIs, authentication, and third-party services
- **File System Operations**: Reads, writes, and manages project files with understanding
- **Quality Assurance**: Implements testing, linting, and code quality measures

### Multi-LLM Support
- **Anthropic Claude**: Primary reasoning and coding capabilities
- **OpenAI GPT**: Alternative reasoning and specialized tasks
- **Google Gemini**: Additional model support for diverse capabilities
- **Provider Switching**: Dynamic model selection based on task requirements
- **Rate Limit Management**: Intelligent request distribution across providers

### Workflow Orchestration
- **Step-by-Step Execution**: Breaks complex tasks into manageable steps
- **Context Preservation**: Maintains project understanding across operations
- **Error Recovery**: Handles failures gracefully with retry mechanisms
- **Progress Tracking**: Provides real-time feedback on development progress
- **Decision Making**: Makes intelligent choices based on project context

## Technology Stack

### Core Framework
- **Runtime**: Node.js 20+ with TypeScript
- **Web Framework**: Hono for lightweight HTTP server
- **OpenAPI Integration**: `@hono/zod-openapi` for API specification
- **Request Validation**: Zod schemas for type-safe input validation
- **Logging**: Pino for structured logging with pretty printing

### AI Integration
- **AI SDK**: Vercel AI SDK for unified LLM interfaces
- **Streaming**: Real-time response streaming for long operations
- **Token Management**: Usage tracking and optimization
- **Context Management**: Intelligent context window utilization
- **Tool Integration**: Custom AI tools for development operations

### Browser & File Operations
- **Browser Automation**: Playwright for web interactions and testing
- **File System**: Node.js fs operations with safety checks
- **Command Execution**: Secure process spawning with sandboxing
- **Project Management**: Git operations and version control

### Storage & Services
- **File Storage**: AWS S3 integration for project assets
- **Database**: Connection to @weldr/db for project metadata
- **Authentication**: Integration with @weldr/auth for user sessions
- **Shared Utilities**: @weldr/shared for common functionality

## Project Structure

### Core Directories

#### AI System (`src/ai/`)
**Agents (`src/ai/agents/`)**
- `coder.ts` - Main coding agent for code generation and editing
- `planner.ts` - Project planning and architecture decisions
- `enricher/` - Content enrichment and context gathering agents

**Tools (`src/ai/tools/`)**
- `call-coder.ts` - Interface for coding operations
- `delete-file.ts` - Safe file deletion operations
- `done.ts` - Task completion and validation
- `edit-file.ts` - File editing with context awareness
- `read-file.ts` - Intelligent file reading and understanding
- `write-file.ts` - File creation with proper formatting
- `run-command.ts` - Secure command execution
- `create-directory.ts` - Directory structure creation
- Additional specialized tools for specific operations

**Prompts (`src/ai/prompts/`)**
- `architect.ts` - System architecture guidance
- `authentication-coder.ts` - Authentication implementation patterns
- `coding-guidelines.ts` - Code quality and style guidelines
- `context.ts` - Context understanding and maintenance
- `planner.ts` - Project planning methodologies
- `security-reviewer.ts` - Security audit and recommendations
- `task-decomposer.ts` - Task breakdown strategies

**Utilities (`src/ai/utils/`)**
- `commands.ts` - Command execution utilities
- `content-to-text.ts` - Content parsing and extraction
- `create-tool.ts` - Tool creation helpers
- `file-operations.ts` - File system operation utilities
- `get-file-tree.ts` - Project structure analysis
- `project-context.ts` - Project understanding utilities

#### Workflow Engine (`src/workflow/`)
- `engine.ts` - Core workflow orchestration
- `context.ts` - Workflow context management
- `steps/` - Individual workflow step implementations
  - `code.ts` - Code generation workflow
  - `deploy.ts` - Deployment workflow
  - `enrich.ts` - Content enrichment workflow
  - `plan.ts` - Planning workflow

#### HTTP API (`src/routes/`)
- `events.ts` - Server-sent events for real-time updates
- `health.ts` - Health check endpoints
- `index.ts` - Main route definitions
- `workflow.ts` - Workflow management endpoints

#### Infrastructure (`src/lib/`)
- `constants.ts` - Application constants and configuration
- `logger.ts` - Structured logging configuration
- `utils.ts` - General utility functions

#### Middleware (`src/middlewares/`)
- `logger.ts` - Request/response logging middleware

### Project Templates (`data/boilerplates/`)

#### Available Templates
- **`add-server/`** - Backend API server boilerplate
- **`add-web/`** - Frontend web application boilerplate
- **`full-stack/`** - Complete full-stack application
- **`server-only/`** - Backend-only application
- **`web-only/`** - Frontend-only application

#### Template Features
- Modern TypeScript configuration
- Proper project structure
- Essential dependencies included
- Development and build scripts
- Linting and formatting setup
- Docker configuration for deployment

### Utility Scripts (`scripts/`)
- `add-server.sh` - Add server components to projects
- `add-web.sh` - Add web components to projects
- `build.sh` - Production build script
- `setup-project.sh` - Initial project setup
- Additional automation scripts

## Available Commands

### Development
```bash
pnpm dev          # Start development server with hot reload and watch mode
pnpm build        # Build production bundle with esbuild optimization
pnpm start        # Start production server from built bundle
pnpm check-types  # TypeScript type checking without emission
```

### Environment Management
```bash
pnpm with-env <cmd>  # Run commands with environment variables loaded
```

## API Endpoints

### Workflow Management
- `GET /health` - Service health check
- `POST /workflow/start` - Initiate new development workflow
- `GET /workflow/:id/status` - Get workflow execution status
- `POST /workflow/:id/cancel` - Cancel running workflow
- `GET /events` - Server-sent events for real-time updates

### File Operations
- `POST /files/read` - Read project files with context
- `POST /files/write` - Write files with validation
- `POST /files/delete` - Safely delete files
- `GET /files/tree` - Get project structure

### Command Execution
- `POST /commands/execute` - Execute shell commands securely
- `GET /commands/:id/status` - Get command execution status
- `POST /commands/:id/cancel` - Cancel running command

## Environment Configuration

### Required Variables
```bash
# AI Provider Configuration
ANTHROPIC_API_KEY=sk-ant-...           # Anthropic Claude API access
OPENAI_API_KEY=sk-...                  # OpenAI GPT API access
GOOGLE_AI_API_KEY=...                  # Google Gemini API access

# Database Connection
DATABASE_URL=postgresql://...          # PostgreSQL connection string

# Storage Configuration
AWS_ACCESS_KEY_ID=...                  # AWS S3 access credentials
AWS_SECRET_ACCESS_KEY=...              # AWS S3 secret key
AWS_REGION=us-east-1                   # AWS region for S3
S3_BUCKET_NAME=weldr-projects          # S3 bucket for project storage

# Application Configuration
NODE_ENV=development                   # Environment mode
PORT=8080                             # Server port
LOG_LEVEL=info                        # Logging level

# Security Configuration
AGENT_SECRET=...                      # Agent authentication secret
ALLOWED_ORIGINS=http://localhost:3000  # CORS allowed origins
```

### Optional Variables
```bash
# Development Features
ENABLE_PLAYGROUND=true                 # Enable API playground
VERBOSE_LOGGING=true                   # Detailed operation logging
MOCK_AI_RESPONSES=false               # Use mock responses for testing

# Performance Tuning
MAX_CONCURRENT_WORKFLOWS=5             # Maximum parallel workflows
COMMAND_TIMEOUT=300000                # Command timeout in milliseconds
AI_REQUEST_TIMEOUT=120000             # AI provider timeout
```

## Development Guidelines

### AI Agent Development
- **Prompt Engineering**: Create clear, specific prompts for consistent results
- **Context Management**: Maintain relevant context while staying within token limits
- **Error Handling**: Implement graceful degradation for AI failures
- **Tool Creation**: Follow established patterns for new AI tools
- **Testing**: Use mock responses for reliable testing

### Security Considerations
- **Command Sandboxing**: Never execute arbitrary user commands without validation
- **File System Security**: Validate all file paths and prevent directory traversal
- **Input Sanitization**: Clean and validate all external inputs
- **API Authentication**: Implement proper authentication for all endpoints
- **Resource Limits**: Prevent resource exhaustion from long-running operations

### Performance Optimization
- **Streaming Responses**: Use streaming for long-running AI operations
- **Caching**: Cache AI responses and project metadata when appropriate
- **Connection Pooling**: Efficient database and AI provider connections
- **Background Processing**: Use background jobs for non-blocking operations
- **Resource Monitoring**: Track memory and CPU usage during development

### Testing Strategy
- **Unit Tests**: Test individual tools and utilities
- **Integration Tests**: Test AI agent workflows end-to-end
- **Mock Testing**: Use mocked AI responses for consistent testing
- **Performance Tests**: Validate response times and resource usage
- **Security Tests**: Verify security measures and input validation

## Workflow Examples

### Full-Stack Application Generation
1. **Requirements Analysis**: Parse natural language requirements
2. **Architecture Planning**: Design system architecture and tech stack
3. **Project Scaffolding**: Create project structure and configuration
4. **Database Design**: Design and implement database schema
5. **Backend Development**: Generate API endpoints and business logic
6. **Frontend Development**: Create UI components and user interfaces
7. **Integration**: Connect frontend and backend with type safety
8. **Testing Setup**: Implement testing framework and initial tests
9. **Deployment Configuration**: Set up Docker and deployment configs
10. **Documentation**: Generate comprehensive project documentation

### Code Enhancement Workflow
1. **Code Analysis**: Understand existing codebase and patterns
2. **Requirement Understanding**: Parse enhancement requirements
3. **Impact Assessment**: Analyze potential changes and dependencies
4. **Implementation Planning**: Plan changes with minimal disruption
5. **Code Generation**: Write new code following existing patterns
6. **Integration**: Integrate changes with existing codebase
7. **Testing**: Ensure changes don't break existing functionality
8. **Documentation Updates**: Update relevant documentation

## Integration with Weldr Platform

### Web Platform Integration
- Real-time progress updates through server-sent events
- Project metadata synchronization with web interface
- User authentication and session management
- File sharing and collaborative editing support

### Database Integration
- Project metadata storage and retrieval
- User workflow history and preferences
- Generated code versioning and backup
- Analytics and usage tracking

### Deployment Integration
- Automatic deployment pipeline setup
- Environment configuration management
- Monitoring and health check implementation
- Scaling and performance optimization

## Troubleshooting

### Common Issues
- **AI Provider Errors**: Check API keys, rate limits, and service status
- **File System Errors**: Verify permissions and available disk space
- **Command Execution Failures**: Check command syntax and security restrictions
- **Memory Issues**: Monitor memory usage during large projects
- **Network Connectivity**: Ensure stable internet for AI provider access

### Debugging Tools
- **Structured Logging**: Use Pino logs for detailed operation tracking
- **Health Endpoints**: Monitor service status and dependencies
- **Workflow Tracing**: Track workflow execution step by step
- **Performance Metrics**: Monitor response times and resource usage
- **Error Reporting**: Comprehensive error context and stack traces

### Performance Monitoring
- **Response Times**: Track AI provider and workflow response times
- **Resource Usage**: Monitor CPU, memory, and disk usage
- **Success Rates**: Track workflow completion and failure rates
- **User Satisfaction**: Monitor generated code quality and user feedback
