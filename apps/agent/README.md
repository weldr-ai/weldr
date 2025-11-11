# Weldr Agent

> **Note**: This README was generated using AI.

A unified development environment for AI agents to develop applications with integrated workflow execution, branch management, and integration installation capabilities.

## Features

- **Agent-Ready Environment**: Optimized for AI agents to autonomously develop applications
- **Workflow Execution**: Multi-step workflow system for planning, coding, and completing tasks
- **Branch Management**: Git-based version control with branch directories and S3 synchronization
- **Integration System**: Installable integrations for authentication, backend, database, and frontend
- **Real-time Streaming**: Server-Sent Events (SSE) for real-time workflow updates with resumable streams
- **Better Auth Integration**: Secure authentication layer for API access
- **State Recovery**: Automatic recovery of in-progress workflows and enriching jobs on server restart
- **Declaration Enrichment**: Background job system for generating semantic data and embeddings for code declarations
- **Shared State Management**: Centralized workspace and state management via `@weldr/shared/state` package

## Architecture

### Core Components

1. **Agent Server**: Node.js/TypeScript HTTP server built with Hono and OpenAPI
2. **Workflow Engine**: Multi-step workflow system with status-based execution (pending → planning → coding → complete)
3. **Git Integration**: Version control system for managing code changes and reverts
4. **State Management**: Centralized workspace and state management via `@weldr/shared/state` package
5. **Branch State Manager**: Ephemeral state management for branch directories and workspace
6. **Integration Installer**: Queue-based system for installing project integrations
7. **Streaming System**: Redis-based SSE streaming for real-time event delivery with resumable streams
8. **Enriching Jobs**: Background job queue for generating semantic data and embeddings for code declarations
9. **Better Auth**: Authentication layer for secure API access

### How It Works

Each user's project gets a single isolated machine on Fly.io that provides:
- **HTTP API**: RESTful endpoints for triggering workflows, streaming events, and managing integrations
- **Branch Directories**: Isolated workspace directories per branch for code access
  - **Local Mode**: `~/.weldr/{projectId}/{branchId}` (stored locally, no S3 sync)
  - **Cloud Mode**: `/workspace/{branchId}` (stored on SSD with S3 backup/restore)
- **Workflow Execution**: Multi-step AI agent workflow that plans, codes, and completes tasks
- **State Persistence**: Branch metadata stored in `weldr-branch-state.json`
  - **Cloud Mode**: Automatic S3 synchronization for backup and restore
  - **Local Mode**: Stored locally, no S3 sync required
- **Active Projects Tracking**: Local mode tracks active projects in `weldr-active-projects.json` for workflow recovery
- **Integration Management**: Queue-based installation system for project integrations

In cloud mode, all state is managed ephemerally - branch directories are stored on local SSD with automatic S3 synchronization for backup and restore. In local mode, branch directories are stored locally at `~/.weldr` without S3 sync.

## Deployment

This application runs as an isolated development machine on Fly.io for each project. Each instance provides a sandboxed workspace with HTTP API endpoints for workflow execution, integration management, and version control.

### Building the Docker Image

To build the Docker image for the agent application, run the following command from the root of the monorepo:

```bash
docker build --platform "linux/amd64" -f apps/agent/Dockerfile -t registry.fly.io/weldr-images:weldr-agent .
```

This builds a Linux AMD64 image with all required tools suitable for deployment on Fly.io infrastructure.

### Environment Variables

**Required:**
- `DATABASE_URL`: PostgreSQL connection string (used by `@weldr/db` package)
- `REDIS_URL`: Redis connection URL (required for streaming functionality)
- `BETTER_AUTH_SECRET`: Secret key for Better Auth authentication (used by the authentication integration)
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude models
- `OPENAI_API_KEY`: OpenAI API key for GPT models and embeddings
- `GEMINI_API_KEY`: Google Gemini API key for Gemini models

**Required (Cloud Mode Only):**
- `S3_ACCESS_KEY_ID`: Tigris access key ID (project-specific credentials for bucket operations)
- `S3_SECRET_ACCESS_KEY`: Tigris secret access key (project-specific credentials for bucket operations)
- `S3_ENDPOINT`: S3 endpoint URL (defaults to `https://fly.storage.tigris.dev` in cloud mode)
- `PROJECT_ID`: Project ID for cloud mode (used when `WELDR_MODE=cloud`)

**Optional:**
- `PORT`: Agent server port (default: `8080`)
- `CORS_ORIGIN`: CORS allowed origins, comma-separated (default: `http://localhost:3000`)
- `WELDR_MODE`: Deployment mode - `"local"` or `"cloud"` (defaults to local if unset, falls back to `NODE_ENV`)
  - `"local"`: Desktop app / local development mode (uses `~/.weldr`, dev servers, no S3 sync)
  - `"cloud"`: Fly.io infrastructure mode (uses `/workspace`, no dev servers, requires S3 sync)
- `NODE_ENV`: Node environment (development or production) - used as fallback if `WELDR_MODE` is not set
- `WORKSPACE_BASE`: Base directory for workspace (default: `~/.weldr` in local mode, `/workspace` in cloud mode)
- `S3_REGION`: S3 region (default: `auto`, cloud mode only)

**Security Notes:**
- `BETTER_AUTH_SECRET` is generated during integration installation and must be provided for authentication
- Database and Redis connections are required for the agent to function properly
- S3 credentials are only required in cloud mode for branch directory synchronization and backup
- In local mode, branch directories are stored locally at `~/.weldr` and do not require S3 sync

## API Endpoints

The agent exposes the following HTTP endpoints:

### Workflows
- `POST /trigger` - Trigger an AI workflow with a user message
- `GET /stream/:projectId/:branchId` - Subscribe to workflow events via Server-Sent Events (SSE)
- `POST /revert` - Revert to a previous version by creating a revert commit

### Integrations
- `POST /integrations/install` - Install queued integrations for a project

### Health
- `GET /health` - Health check endpoint

## Workflow System

The agent uses a multi-step workflow system that progresses through the following states:

1. **pending** → Initial state when a workflow is triggered
2. **planning** → AI agent plans the task and creates a detailed plan
3. **coding** → AI agent executes the plan and makes code changes using AI tools
4. **complete** → Workflow step completes and transitions to finalization
5. **completed** → Workflow is fully completed and changes are finalized
6. **failed** → Workflow has failed and cannot continue

### Workflow Steps

- **Plan Step**: Analyzes the user's request and creates a detailed plan (handles `pending` and `planning` states)
- **Code Step**: Executes the plan by making code changes using AI tools (handles `coding` state)
- **Complete Step**: Finalizes the workflow and updates the version status (handles `complete` state)

### Workflow Recovery

On server restart, the agent automatically:
1. Recovers any in-progress workflows (status: `coding`) and resumes execution
2. Recovers enriching jobs for declarations in `enriching` state
3. In local mode, uses `weldr-active-projects.json` to identify active projects for recovery
4. In cloud mode, uses `PROJECT_ID` environment variable to identify the project

## Directory Structure

### Local Mode (`~/.weldr/`)
```
~/.weldr/                         # Base directory (local mode only)
  weldr-dev-servers.json          # Running dev servers (managed by web app)
  weldr-active-projects.json      # Active project tracking
  weldr-branch-state.json         # Global branch metadata
  {projectId}/                    # Project directory
    {branchId}/                   # Branch workspace
      ...                         # Project code
```

### Cloud Mode (`/workspace/`)
```
/workspace/                       # Base directory (cloud mode only)
  weldr-branch-state.json         # Global branch metadata
  {branchId}/                     # Branch workspace (flat structure)
    ...                           # Project code

/usr/local/bin/                   # System scripts
  create-branch-dir.sh            # Create or reuse branch directory
  sync-from-s3.sh                 # Sync branch directory from S3 bucket
  sync-to-s3.sh                   # Sync branch directory to S3 bucket
  cleanup-lru.sh                  # Remove least recently used branch directories
```

**Note**:
- **Local Mode**: Desktop app / local development with dev servers on ports 9000-9009
- **Cloud Mode**: Each project runs on its own isolated Fly.io machine
- Cloud mode uses flat structure: `/workspace/{branchId}` (no projectId nesting)
- Preview proxying is local-only; cloud mode routes directly to Fly.io machines

## Branch Management

### Branch Directories

Each branch gets its own isolated workspace directory:
- **Location**:
  - **Local Mode**: `~/.weldr/{projectId}/{branchId}` (project-organized, multiple projects)
  - **Cloud Mode**: `/workspace/{branchId}` (flat structure, one project per machine)
- **S3 Sync** (cloud mode only): Branch directories are synchronized with S3 buckets for backup and restore
- **Dev Servers** (local mode only): Dev servers managed by web app on ports 9000-9009 with LRU eviction
- **Cloud Mode**: Each project runs on its own Fly.io machine, no local dev servers or preview proxy

### Branch State

Branch state is managed through:
- **Global Branch State**: `weldr-branch-state.json` stores global branch metadata (location, size, last accessed) for all branches
- **Active Projects**: `weldr-active-projects.json` (local mode only) tracks active projects for recovery
- **Dev Servers**: `weldr-dev-servers.json` (local mode only) tracks running development servers
- **Git Repository**: Each branch directory contains a git repository for version control
- **S3 Backup** (cloud mode only): Branch directories are backed up to S3 for persistence across restarts
- **State Management**: All state management is centralized in `@weldr/shared/state` package

### LRU Cleanup

When disk space is needed, the system automatically removes least recently used branch directories to free up space. The cleanup process:
- Monitors volume usage (target: 70%, max: 85%)
- Removes oldest unused branch directories when needed
- Preserves active branches and recent work

## Integration System

The agent supports installing integrations for:
- **Authentication**: Better Auth and other auth providers
- **Backend**: API frameworks and server technologies (e.g., oRPC)
- **Database**: Database drivers and ORMs (e.g., PostgreSQL with Drizzle)
- **Frontend**: UI frameworks and component libraries (e.g., TanStack Start)

### Integration Installation

Integrations are installed via a queue-based system:
1. Integrations are queued for installation
2. Installation is processed asynchronously
3. Integration files are generated and installed in the project
4. Declarations are extracted and enriched with semantic data
5. Workflow can be triggered after installation completes

## Declaration Enrichment System

The agent includes a background job system for enriching code declarations with semantic data:

### Features
- **Automatic Enrichment**: Declarations are automatically queued for enrichment after extraction
- **Semantic Data Generation**: AI-generated semantic descriptions and metadata for code declarations
- **Embedding Generation**: Vector embeddings for semantic search and code understanding
- **Queue-Based Processing**: Batched processing (up to 5 jobs concurrently) for efficiency
- **Retry Logic**: Automatic retry with exponential backoff (max 3 retries)
- **Recovery**: Enriching jobs are automatically recovered on server restart

### Declaration States
- **pending** → Declaration extracted but not yet enriched
- **enriching** → Currently being processed for semantic data generation
- **completed** → Semantic data and embeddings successfully generated

## Streaming System

The agent uses Server-Sent Events (SSE) for real-time workflow updates:

### Features
- **Resumable Streams**: Streams can be resumed using `Last-Event-ID` header or `lastEventId` query parameter
- **Redis Backend**: Events are stored in Redis for reliable delivery and resumption
- **Multiple Subscribers**: Multiple clients can subscribe to the same workflow
- **Event Types**: Status updates (thinking, planning, coding), messages, and workflow completion events
- **Stream ID Management**: Each stream has a unique ID tracked in Redis for resumption

### Stream Endpoint

```
GET /stream/:projectId/:branchId?lastEventId=<event_id>
```

The stream endpoint supports:
- **Resumption**: Use `lastEventId` query parameter to resume from a specific event
- **Automatic Reconnection**: Clients can reconnect and resume from the last event
- **Event Filtering**: Events are filtered by project and branch via chat ID
- **Stream ID**: Each stream is assigned a unique ID returned in `X-Stream-ID` header

## Port Management

- The agent server runs on port `8080` by default (configurable via `PORT` environment variable)
- CORS is configured to allow requests from specified origins (default: `http://localhost:3000`)

## Security Considerations

- Better Auth provides authentication layer for API endpoints
- All endpoints require valid authentication (except `/health`)
- Project and branch access is validated against the authenticated user
- Git operations are performed in isolated branch directories
- Branch directories are isolated per branch to prevent cross-contamination

## Limitations

- **Cloud Mode**: Branch directories are ephemeral (stored on local SSD, backed up to S3)
- **Cloud Mode**: Maximum volume usage is monitored (85% hard limit, 70% target)
- **Cloud Mode**: LRU cleanup removes unused branch directories when space is needed
- **Local Mode**: Branch directories are stored locally at `~/.weldr` (no S3 backup, no volume limits)
- Workflow recovery only works for workflows in `coding` status
- One active workflow per branch at a time

## AI Tools

The agent has access to a comprehensive set of AI tools for code manipulation:

- **File Operations**: `read-file`, `write-file`, `edit-files`, `delete-file`
- **Code Search**: `grep`, `find`, `fzf`, `search-codebase`
- **Directory Operations**: `list-dir`
- **Package Management**: `install-packages`, `remove-packages`
- **Code Generation**: `call-coder` (invokes the coder agent)
- **Integration Management**: `add-integrations`
- **Declaration Queries**: `query-related-declarations`
- **Workflow Control**: `done`, `reapply`

## Available Scripts

### Development
- `pnpm dev` - Start development server with hot reload (uses `with-env` for environment variables)
- `pnpm build` - Build for production using tsdown
- `pnpm start` - Run production server
- `pnpm typecheck` - Run TypeScript type checking

### System Scripts (in container)
- `/usr/local/bin/create-branch-dir.sh <branch_id> <project_id>` - Create or reuse branch directory (triggers LRU cleanup if needed)
- `/usr/local/bin/sync-from-s3.sh <branch_id> <project_id>` - Sync branch directory from S3 bucket (restores latest code)
- `/usr/local/bin/sync-to-s3.sh <branch_id> <project_id>` - Sync branch directory to S3 bucket (backup)
- `/usr/local/bin/cleanup-lru.sh` - Remove least recently used branch directories to free space

### Graceful Shutdown

When the agent receives SIGTERM or SIGINT (machine shutdown), it:
1. Closes Redis connections
2. Exits gracefully

Branch directories persist on the local SSD volume and are cleaned up automatically by LRU when space is needed.

## Tech Stack

- **Runtime**: Node.js 22 with TypeScript
- **Framework**: Hono with OpenAPI (Zod validation)
- **Package Manager**: pnpm
- **Build Tool**: tsdown
- **Database**: PostgreSQL (via `@weldr/db` package with Drizzle ORM)
- **Cache/Queue**: Redis (for streaming functionality and event storage)
- **Authentication**: Better Auth
- **Version Control**: Git (via simple-git)
- **Storage**: Local SSD (20GB) with Tigris S3 backup via rclone
- **Deployment**: Docker + Fly.io
- **AI SDK**: Vercel AI SDK with Anthropic, OpenAI, and Google providers
- **State Management**: `@weldr/shared/state` package for centralized workspace and state management
- **Logging**: `@weldr/shared/logger` for structured logging
