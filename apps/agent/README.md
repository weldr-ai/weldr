# Weldr Agent

A unified development environment for AI agents to develop applications with integrated S3 bucket mounting, preview app management, and command execution capabilities.

## Features

- **Agent-Ready Environment**: Optimized for AI agents to autonomously develop applications
- **S3 Bucket Mounting API**: HTTP endpoints to mount/unmount Tigris S3 buckets as local filesystems using JuiceFS
- **Preview App Management API**: HTTP endpoints to start/stop/list containerized preview applications (ports 3000-3019)
- **Ephemeral State Management**: JSON-based state tracking for mounts, apps, and port allocations
- **Authentication Integration**: Better Auth integration for secure API access
- **Automated Scripts**: Bash scripts for bucket mounting, app lifecycle, and environment management
- **Multiple Concurrent Mounts**: Support for up to 5 concurrent bucket mounts with intelligent resource distribution

## Architecture

### Core Components

1. **Agent Server**: Node.js/TypeScript HTTP server built with Hono and OpenAPI
2. **JuiceFS**: Distributed filesystem that presents S3 buckets as POSIX-compliant filesystems
3. **Litestream**: Continuous backup service for JuiceFS metadata SQLite databases
4. **Crun**: Lightweight OCI-compliant container runtime for preview apps
5. **Mount State Manager**: Ephemeral JSON-based state management for mounts, apps, and port allocations
6. **Better Auth**: Authentication layer for secure API access

### How It Works

Each user's project gets a single isolated machine on Fly.io that provides:
- **HTTP API**: RESTful endpoints for mounting buckets, managing preview apps, and triggering workflows
- **Bucket Mounts**: Tigris S3 buckets mounted as local filesystems at `/workspace/{bucket_name}` for code access
- **Preview Apps**: Containerized applications running on ports 3000-3019 with automatic port allocation
- **State Persistence**: Ephemeral state management with automatic S3 backup/restore for metadata databases

All state is managed ephemerally - mount and app state is tracked in `/tmp/weldr_env/mounts.json`, while JuiceFS metadata databases are continuously backed up to S3 via Litestream.

## Deployment

This application runs as an isolated development machine on Fly.io for each project. Each instance provides a sandboxed workspace with HTTP API endpoints for bucket mounting, preview app management, and workflow execution.

### Building the Docker Image

To build the Docker image for the agent application, run the following command from the root of the monorepo:

```bash
docker build --platform "linux/amd64" -f apps/agent/Dockerfile -t registry.fly.io/weldr-images:weldr-agent .
```

This builds a Linux AMD64 image with all required tools (JuiceFS, Litestream, crun, Bun) suitable for deployment on Fly.io infrastructure.

### Environment Variables

**Required:**
- `DATABASE_URL`: PostgreSQL connection string (used by `@weldr/db` package)
- `REDIS_URL`: Redis connection URL (required for streaming functionality)
- `S3_ACCESS_KEY_ID`: Tigris access key ID (project-specific credentials for bucket operations)
- `S3_SECRET_ACCESS_KEY`: Tigris secret access key (project-specific credentials for bucket operations)
- `BETTER_AUTH_SECRET`: Secret key for Better Auth authentication (used by the authentication integration)
- `PROJECT_ID`: Project ID for production mode (used when `NODE_ENV=production`)
- `ANTHROPIC_API_KEY`: Anthropic API key for Claude models
- `OPENAI_API_KEY`: OpenAI API key for GPT models and embeddings
- `GEMINI_API_KEY`: Google Gemini API key for Gemini models

**Optional:**
- `S3_ENDPOINT`: S3 endpoint URL (defaults to `https://t3.storage.dev` in development, `https://fly.storage.tigris.dev` in production)
- `S3_REGION`: S3 region (default: `auto`)
- `PORT`: Agent server port (default: `8080`)
- `CORS_ORIGIN`: CORS allowed origins, comma-separated (default: `http://localhost:3000`)
- `NODE_ENV`: Environment mode (development or production)
- `WELDR_ENV_VOL`: Persistent volume base directory (default: `/dev/weldr_env_vol`)
- `WORKSPACE_BASE`: Base directory for mounts (default: `/workspace`)
- `FS_MOUNT_OPTIONS`: Additional JuiceFS mount options

**Security Notes:**
- The agent app uses project-specific Tigris credentials (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`) that are scoped to individual projects
- `BETTER_AUTH_SECRET` is generated during integration installation and must be provided for authentication
- Database and Redis connections are required for the agent to function properly


## API Endpoints

The agent exposes the following HTTP endpoints:

### Mounts
- `POST /mounts` - Mount a Tigris S3 bucket as a JuiceFS filesystem
- `POST /mounts/unmount` - Unmount a bucket (requires stopping apps first)

### Previews
- `POST /previews/start` - Start a containerized preview app on a mounted bucket
- `POST /previews/stop` - Stop a running preview app
- `GET /previews` - List all running preview apps

### Workflows
- `POST /trigger` - Trigger an AI workflow
- `GET /events` - Server-sent events stream for workflow updates
- `POST /revert` - Revert changes from a workflow
- `POST /install-integrations` - Install project integrations

### Health
- `GET /health` - Health check endpoint

## Directory Structure

```
/workspace/                       # Base directory for mounts
  {bucket_name}/                  # Mount point for each bucket

/dev/WELDR_ENV_VOL/                     # Persistent volume storage (or WELDR_ENV_VOL)
  mounts.json                     # State file (mounts, apps, ports)
  meta/                           # Metadata database directory
    {bucket_name}.db              # JuiceFS metadata database per bucket
  cache/                          # Cache directory
    {bucket_name}/                # JuiceFS cache directory per bucket
  juicefs-{bucket}.log            # JuiceFS process logs per bucket
  litestream-{bucket}.yml         # Litestream config per bucket
  litestream-{bucket}.log         # Litestream process logs per bucket
  apps/                           # App configuration and logs
    {bucket_name}/                # App configuration per bucket
      run.sh                      # App runner script
      app.log                     # Application logs

/usr/local/bin/                   # System scripts
  mount-bucket.sh                 # Mount a bucket with JuiceFS + Litestream
  unmount-bucket.sh               # Unmount a bucket safely
  start-app.sh                    # Start a preview app in a container
  stop-app.sh                     # Stop a preview app
  weldr-user-env.sh               # Environment variable sourcing

/etc/                             # System configuration
  litestream-template.yml         # Template for per-bucket Litestream configs
```

## JuiceFS Configuration

Each bucket mount is configured with performance-optimized settings specifically tuned for coding workloads and constrained resources:

### Storage & Metadata
- **Storage**: Tigris S3-compatible backend
- **Metadata**: Per-bucket SQLite database with WAL mode (backed up to S3 via Litestream)
- **Trash**: 7-day retention
- **SQLite Optimizations**: WAL journaling, NORMAL sync, 64MB cache, memory temp store

### Cache & Buffer (Optimized for Multi-Tenant Environment)
- **Cache Size**: Dynamically distributed across mounts (~500MB per mount with max 5 mounts)
  - 1GB reserved for metadata DBs
  - 500MB reserved for overhead
  - Remaining ~2.5GB split fairly across active mounts
- **Free Space Ratio**: 1% minimum free space (aggressive caching, flushes only when 99% full)
- **Buffer Size**: 100-256MB per mount (distributed from 400MB total pool)
  - Conservative allocation prevents OOM with 1GB total RAM
  - Scales down automatically with more active mounts

### Metadata Cache (Aggressive Caching for Small Files)
- **Attribute Cache**: 300 seconds (file size, mtime, permissions)
- **Entry Cache**: 300 seconds (file/directory lookup)
- **Directory Entry Cache**: 300 seconds (directory listings)
- **Open Cache**: Disabled (conserves memory in constrained environment)
  - **Critical for performance**: Dramatically reduces metadata DB hits
  - Operations like `rm -rf node_modules` or `bun install` benefit most
  - 5-minute window where external changes may not be visible

### Write Performance (Optimized for Small Files)
- **Writeback**: Enabled (improves small file write performance for git and package installs)
- **Writeback Cache**: Kernel-level writeback for random small writes
- **Upload Delay**: 5 minutes (aggressive batching reduces fragmentation)
- **Max Uploads**: 5 concurrent uploads (conserves memory and network resources)

### Environment Variable Overrides

All mount settings can be customized via environment variables:

```bash
# Cache settings
CACHE_SIZE_MB=51200           # Override cache size (in MB)
FREE_SPACE_RATIO=0.1         # Free space ratio (0.1 = 10%)

# Buffer settings
BUFFER_SIZE_MB=4096          # Override buffer size (in MB)

# Metadata cache TTL (seconds)
ATTR_CACHE_TTL=3             # Attribute cache TTL
ENTRY_CACHE_TTL=3            # Entry cache TTL
DIR_ENTRY_CACHE_TTL=5        # Directory entry cache TTL
OPEN_CACHE_TTL=10            # Open cache TTL

# Read performance
MAX_READAHEAD_MB=64           # Max readahead window (MB)
PREFETCH=2                   # Prefetch concurrency
VERIFY_CACHE=sha256          # Cache verification (sha256, md5, or off)

# Write performance
WRITEBACK_ENABLED=1          # Enable writeback (1 or 0)
UPLOAD_DELAY=1m              # Upload delay (e.g., "1m", "30s")
MAX_UPLOADS=20               # Concurrent uploads

# Additional options
FS_MOUNT_OPTIONS="..."       # Additional JuiceFS mount options
```

These settings are optimized for coding workflows where you'll be:
- **Editing code**: Frequent random file reads/writes (benefits from 5-minute metadata cache and writeback)
- **Using git**: Many small file operations and metadata queries (benefits from aggressive entry cache and writeback)
- **Installing packages (bun)**: Many small files written sequentially (benefits from writeback and 5-minute upload batching)
- **Deleting dependencies**: Operations like `rm -rf node_modules` (benefits from cached directory listings, avoiding DB hits per file)
- **Building apps**: Sequential reads of source files (benefits from local cache)
- **Running apps**: Repeated file access (benefits from local cache and attribute cache)

## Litestream Configuration

Litestream continuously replicates each JuiceFS metadata database to its corresponding S3 bucket:

- **Sync Interval**: 10 seconds
- **Snapshot Interval**: 1 hour
- **Retention**: 4 hours
- **Per-Bucket Configuration**: Each mounted bucket gets its own Litestream process and config

If a metadata database is missing during mount, Litestream will automatically attempt to restore it from S3.

## Port Management

- Ports `3000-3019` are available for preview applications (20 ports total)
- Ports are automatically allocated if not specified when starting an app
- Port allocation is tracked in the ephemeral state file (`mounts.json`)
- Port conflicts are detected and prevented
- Each bucket can only run one app at a time

## Security Considerations

- Container runs with `--privileged` mode (required for filesystem mounting with JuiceFS)
- Uses `crun` for OCI-compliant container isolation of preview apps
- Preview apps run with restricted capabilities and namespaces
- Cgroup limits applied to containerized apps
- Network namespaces isolate app networking
- Better Auth provides authentication layer for API endpoints
- Project-specific Tigris credentials are scoped to individual buckets

## Limitations

- Maximum 5 concurrent bucket mounts (enforced via API for optimal performance with 4GB volume)
- Maximum 20 concurrent preview apps (port range 3000-3019)
- One preview app per bucket at a time
- Requires `--privileged` container mode on Fly.io
- Mount and app state is ephemeral (lost on machine restart, but metadata databases are restored from S3)
- Tigris S3 credentials must be provided via environment variables

## Available Scripts

### Development
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production using tsdown
- `npm start` - Run production server

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
- **Container Tools**: Bun, rclone
- **Storage**: Local SSD (20GB) with Tigris S3 backup via rclone
- **Deployment**: Docker + Fly.io
