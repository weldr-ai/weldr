# Weldr Agent

> **Note**: This README was generated using AI.

A unified development environment for AI agents to develop applications with integrated workflow execution, branch management, and integration installation capabilities.

## Features

- **Agent-Ready Environment**: Optimized for AI agents to autonomously develop applications
- **Workflow Execution**: Multi-step workflow system for planning, coding, and completing tasks
- **Branch Management**: Git-based version control with branch directories and S3 synchronization
- **Integration System**: Installable integrations for authentication, backend, database, and frontend
- **Real-time Streaming**: Server-Sent Events (SSE) for real-time workflow updates
- **Better Auth Integration**: Secure authentication layer for API access
- **State Recovery**: Automatic recovery of in-progress workflows on server restart

## Architecture

### Core Components

1. **Agent Server**: Node.js/TypeScript HTTP server built with Hono and OpenAPI
2. **Workflow Engine**: Multi-step workflow system with status-based execution (pending → planning → coding → complete)
3. **Git Integration**: Version control system for managing code changes and reverts
4. **Branch State Manager**: Ephemeral state management for branch directories and workspace
5. **Integration Installer**: Queue-based system for installing project integrations
6. **Streaming System**: Redis-based SSE streaming for real-time event delivery
7. **Better Auth**: Authentication layer for secure API access

### How It Works

Each user's project gets a single isolated machine on Fly.io that provides:
- **HTTP API**: RESTful endpoints for triggering workflows, streaming events, and managing integrations
- **Branch Directories**: Isolated workspace directories per branch at `/workspace/{branch_id}` for code access
- **Workflow Execution**: Multi-step AI agent workflow that plans, codes, and completes tasks
- **State Persistence**: Branch metadata stored in `.weldr-state.json` with S3 backup/restore
- **Integration Management**: Queue-based installation system for project integrations

All state is managed ephemerally - branch directories are stored on local SSD with automatic S3 synchronization for backup and restore.

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
- `S3_ACCESS_KEY_ID`: Tigris access key ID (project-specific credentials for bucket operations)
- `S3_SECRET_ACCESS_KEY`: Tigris secret access key (project-specific credentials for bucket operations)
- `BETTER_AUTH_SECRET`: Secret key for Better Auth authentication (used by the authentication integration)
- `PROJECT_ID`: Project ID for cloud mode (used when `WELDR_MODE=cloud`)
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude models
- `OPENAI_API_KEY`: OpenAI API key for GPT models and embeddings
- `GEMINI_API_KEY`: Google Gemini API key for Gemini models
- `S3_ENDPOINT`: S3 endpoint URL (defaults to `https://t3.storage.dev` in local mode, `https://fly.storage.tigris.dev` in cloud mode)

**Optional:**
- `PORT`: Agent server port (default: `8080`)
- `CORS_ORIGIN`: CORS allowed origins, comma-separated (default: `http://localhost:3000`)
- `WELDR_MODE`: Deployment mode - `"local"` or `"cloud"` (defaults to local if unset, falls back to `NODE_ENV`)
  - `"local"`: Desktop app / local development mode (uses `~/.weldr`, dev servers, etc.)
  - `"cloud"`: Fly.io infrastructure mode (uses `/workspace`, no dev servers)
- `NODE_ENV`: Node environment (development or production) - used as fallback if `WELDR_MODE` is not set
- `WORKSPACE_BASE`: Base directory for workspace (default: `~/.weldr` in local mode, `/workspace` in cloud mode)
- `S3_REGION`: S3 region (default: `auto`)

**Security Notes:**
- `BETTER_AUTH_SECRET` is generated during integration installation and must be provided for authentication
- Database and Redis connections are required for the agent to function properly
- S3 credentials are used for branch directory synchronization and backup

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
2. **planning** → AI agent plans the task and creates a plan
3. **coding** → AI agent executes the plan and makes code changes
4. **complete** → Workflow is completed and changes are finalized

### Workflow Steps

- **Plan Step**: Analyzes the user's request and creates a detailed plan
- **Code Step**: Executes the plan by making code changes using AI tools
- **Complete Step**: Finalizes the workflow and updates the version status

### Workflow Recovery

On server restart, the agent automatically recovers any in-progress workflows (status: `coding` or `deploying`) and resumes execution.

## Directory Structure

### Local Mode (`~/.weldr/`)
```
~/.weldr/                         # Base directory (local mode only)
  dev-servers.json                # Running dev servers (managed by web app)
  active-projects.json            # Active project tracking
  global-state.json               # Global branch metadata
  {projectId}/                    # Project directory
    {branchId}/                   # Branch workspace
      branch-state.json           # Branch-specific metadata
      ...                         # Project code
```

### Cloud Mode (`/workspace/`)
```
/workspace/                       # Base directory (cloud mode only)
  global-state.json               # Global branch metadata
  {branchId}/                     # Branch workspace (flat structure)
    branch-state.json             # Branch-specific metadata
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
- **State Files**:
  - `branch-state.json` - Branch-specific metadata
- **S3 Sync**: Branch directories are synchronized with S3 buckets for backup and restore
- **Dev Servers** (local mode only): Dev servers managed by web app on ports 9000-9009 with LRU eviction
- **Cloud Mode**: Each project runs on its own Fly.io machine, no local dev servers or preview proxy

### Branch State

Branch state is managed through:
- **Branch State File**: `branch-state.json` stores branch-specific configuration and state
- **Git Repository**: Each branch directory contains a git repository for version control
- **S3 Backup**: Branch directories are backed up to S3 for persistence across restarts

### LRU Cleanup

When disk space is needed, the system automatically removes least recently used branch directories to free up space. The cleanup process:
- Monitors volume usage (target: 70%, max: 85%)
- Removes oldest unused branch directories when needed
- Preserves active branches and recent work

## Integration System

The agent supports installing integrations for:
- **Authentication**: Better Auth and other auth providers
- **Backend**: API frameworks and server technologies
- **Database**: Database drivers and ORMs
- **Frontend**: UI frameworks and component libraries

### Integration Installation

Integrations are installed via a queue-based system:
1. Integrations are queued for installation
2. Installation is processed asynchronously
3. Integration files are generated and installed in the project
4. Workflow can be triggered after installation completes

## Streaming System

The agent uses Server-Sent Events (SSE) for real-time workflow updates:

### Features
- **Resumable Streams**: Streams can be resumed using `Last-Event-ID` header
- **Redis Backend**: Events are stored in Redis for reliable delivery
- **Multiple Subscribers**: Multiple clients can subscribe to the same workflow
- **Event Types**: Status updates, messages, and workflow completion events

### Stream Endpoint

```
GET /stream/:projectId/:branchId?lastEventId=<event_id>
```

The stream endpoint supports:
- **Resumption**: Use `lastEventId` query parameter to resume from a specific event
- **Automatic Reconnection**: Clients can reconnect and resume from the last event
- **Event Filtering**: Events are filtered by project and branch

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

- Branch directories are ephemeral (stored on local SSD, backed up to S3)
- Maximum volume usage is monitored (85% hard limit, 70% target)
- LRU cleanup removes unused branch directories when space is needed
- Workflow recovery only works for workflows in `coding` or `deploying` status
- One active workflow per branch at a time

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production using tsdown
- `npm start` - Run production server
- `npm run typecheck` - Run TypeScript type checking

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
- **Cache/Queue**: Redis (for streaming functionality)
- **Authentication**: Better Auth
- **Version Control**: Git (via simple-git)
- **Storage**: Local SSD (20GB) with Tigris S3 backup via rclone
- **Deployment**: Docker + Fly.io
- **AI SDK**: Vercel AI SDK with Anthropic, OpenAI, and Google providers
