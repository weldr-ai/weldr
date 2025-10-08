# Dev Machine

A lightweight development environment designed for AI agents to develop applications with a command execution API and project boilerplates.

## Features

- **Agent-Ready Environment**: Optimized for AI agents to autonomously develop applications
- **Command Execution API**: HTTP endpoint to execute shell commands in a controlled environment
- **Project Boilerplates**: Ready-to-use templates for standalone-backend, standalone-frontend, and full-stack projects
- **Automated Scripts**: Collection of utility scripts for workspace management

## Deployment

This application runs as an isolated development machine on Fly.io for each development environment. Each instance provides a sandboxed workspace where AI agents can execute commands and manage projects.

### Building the Docker Image

To build the Docker image for the agent application, run the following command from the root of the monorepo:

```bash
docker build --platform "linux/amd64" -f apps/agent/Dockerfile -t registry.fly.io/weldr-images:weldr-agent .
```

This builds a Linux AMD64 image suitable for deployment on Fly.io infrastructure.

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Run production server

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Go/Mux
- **Deployment**: Docker + Fly.io ready
