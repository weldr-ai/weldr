# @weldr/web

Next.js web frontend application.

## Overview
This is the main web application built with Next.js 15, providing the user interface for the Weldr platform with project management, AI chat, and visual workflow builder.

## Key Dependencies
- `next` - React framework
- `@trpc/next` - tRPC Next.js integration
- `@tanstack/react-query` - Data fetching
- `@weldr/api` - API layer
- `@weldr/ui` - UI components
- `@xyflow/react` - Flow builder
- `lexical` - Rich text editor
- `framer-motion` - Animations

## Commands
- Dev: `pnpm dev` - Start development server
- Build: `pnpm build` - Build for production
- Start: `pnpm start` - Start production server
- Type check: `pnpm check-types`

## Structure
- `src/app/` - Next.js app router pages
- `src/components/` - React components
- `src/lib/` - Utility libraries
- `src/hooks/` - Custom React hooks

## Features
- Project management dashboard
- AI-powered chat interface
- Visual workflow builder
- Authentication system
- Theme customization
- File upload/management
- Real-time updates
- Responsive design