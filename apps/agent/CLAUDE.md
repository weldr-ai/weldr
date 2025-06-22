# @weldr/agent

AI-powered coder agent service with workflow automation capabilities.

## Overview
This service provides an intelligent coder agent that can autonomously write, edit, and manage code projects. It supports multiple LLM providers, workflow automation, and full-stack project generation capabilities.

## Key Dependencies
- `@ai-sdk/anthropic` - Anthropic AI integration
- `@ai-sdk/openai` - OpenAI integration
- `@ai-sdk/google` - Google AI integration
- `hono` - Web framework
- `playwright` - Browser automation
- `@weldr/db` - Database integration
- `@weldr/shared` - Shared utilities

## Commands
- Dev: `pnpm dev` - Start development server with watch mode
- Build: `pnpm build` - Build for production
- Start: `pnpm start` - Start production server
- Type check: `pnpm check-types`

## Structure
- `src/ai/` - AI agents and tools
- `src/ai/agents/` - Agent implementations (coder, planner, enricher)
- `src/ai/tools/` - AI tool definitions
- `src/workflow/` - Workflow engine
- `src/routes/` - HTTP route handlers
- `data/boilerplates/` - Project templates

## Features
- **Autonomous Code Generation**: Writes complete applications from scratch
- **Intelligent Code Editing**: Modifies existing codebases with context awareness
- **Multi-LLM Support**: Integrates with Anthropic, OpenAI, and Google AI models
- **Workflow Automation**: Orchestrates complex development tasks
- **Project Scaffolding**: Generates full-stack applications with best practices
- **File System Operations**: Reads, writes, and manages project files
- **Package Management**: Installs and manages dependencies
- **Integration Setup**: Configures databases, APIs, and third-party services
