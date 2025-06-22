# @weldr/web - Web Platform

## Overview
The Weldr Web application is a modern, responsive web interface for the Weldr development platform. Built with Next.js 15, it provides users with tools for project management, AI-powered chat interfaces, visual editors, authentication, and subscription management.

## Architecture & Core Features

### Key Features
- **Project Management**: Create, view, and manage development projects
- **AI Chat Interface**: Interact with AI agents for code generation and assistance
- **Visual Editor**: Drag-and-drop interface builder for application design
- **Authentication**: Secure user registration, login, and session management
- **Subscription Management**: Integration with Stripe for billing and subscriptions
- **Responsive Design**: Mobile-first interface for all devices
- **Real-time Updates**: Live feedback and progress tracking for AI workflows

### Technology Stack
- **Framework**: Next.js 15 with App Router
- **UI Library**: shadcn/ui with Radix primitives and Tailwind CSS
- **State Management**: tRPC with TanStack Query for server state
- **Form Handling**: React Hook Form with Zod validation
- **Authentication**: @weldr/auth for user sessions
- **API Communication**: @weldr/api for type-safe server communication
- **AI Integration**: Vercel AI SDK for LLM interactions
- **Rich Text Editor**: Lexical for advanced text editing
- **Drag & Drop**: @dnd-kit for interactive interfaces

## Project Structure

### App Router (`src/app/`)
- **`(app)/`** - Main application routes (projects, settings, etc.)
- **`(marketing)/`** - Landing pages and marketing content
- **`auth/`** - Authentication-related routes (sign-in, sign-up, reset-password)
- **`api/`** - API routes for tRPC, webhooks, and authentication callbacks

### Components (`src/components/`)
- **`account-settings/`** - User account management components
- **`auth/`** - Authentication forms and dialogs
- **`canvas/`** - Visual editor components and nodes
- **`chat-integration-dialog/`** - Integration setup dialogs
- **`editor/`** - Lexical editor components and plugins
- **`project-settings/`** - Project-specific settings components
- **`ui/`** - Core UI components and primitives

### Library & Utilities (`src/lib/`)
- **`actions/`** - Server actions for data mutations
- **`context/`** - React context providers
- **`trpc/`** - tRPC client configuration and hooks
- **`store.tsx`** - Zustand store for global state
- **`utils.ts`** - General utility functions

### Hooks & Types
- **`src/hooks/`** - Custom React hooks
- **`src/types/`** - TypeScript type definitions

## Available Commands

### Development
```bash
pnpm dev          # Start development server with Turbopack and hot reload
pnpm build        # Build production-ready application
pnpm start        # Start production server
pnpm check-types  # TypeScript type checking
```

### Environment Management
```bash
pnpm with-env <cmd>  # Run commands with environment variables loaded
```

## UI & Design System

### Core Principles
- **Accessibility**: ARIA compliance and keyboard navigation
- **Responsiveness**: Mobile-first design for all viewports
- **Theming**: Light and dark mode support with CSS variables
- **Consistency**: Adherence to a strict design system

### Component Library (@weldr/ui)
- Built on shadcn/ui and Radix primitives
- Styled with Tailwind CSS
- Fully typed with TypeScript
- Customizable through CSS variables

### State Management Strategy
- **Server State**: tRPC + TanStack Query for data fetching, caching, and mutations
- **Client State**: React's built-in state management (useState, useReducer)
- **Global State**: Zustand for minimal, cross-component state
- **URL State**: Next.js App Router for navigation state

## API Integration

### tRPC Client (`@weldr/api`)
- Type-safe communication with backend services
- Automatic type inference for API responses
- React Query integration for caching and optimistic updates
- Proper error handling and user feedback

### Server Actions
- Used for simple data mutations directly from components
- Secure and type-safe with Zod validation
- Integrated with React Hook Form for seamless user experience

### Authentication (`@weldr/auth`)
- Secure session management with httpOnly cookies
- Client-side hooks for accessing user session
- Protected routes and server components
- Seamless integration with authentication forms

## Environment Configuration

### Required Variables
```bash
# Next.js Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000   # Public URL of the application

# tRPC Configuration
NEXT_PUBLIC_TRPC_URL=/api/trpc             # Public tRPC endpoint

# Database & Auth
DATABASE_URL=...                          # PostgreSQL connection
AUTH_SECRET=...                           # Authentication secret

# File Storage
NEXT_PUBLIC_S3_URL=...                    # Public S3 bucket URL

# Add other necessary environment variables...
```

## Development Guidelines

### Component Development
- Use React Server Components by default
- Apply `'use client'` only when necessary for interactivity
- Implement proper loading states (skeletons) and error boundaries
- Follow accessibility best practices (ARIA, semantic HTML)

### Performance Optimization
- **Image Optimization**: Use `next/image` for all images
- **Code Splitting**: Leverage Next.js dynamic imports for large components
- **Bundle Analysis**: Monitor and optimize application bundle size
- **Caching**: Utilize React Query and Next.js caching strategies
- **Server Components**: Prefer server components to reduce client-side JavaScript

### SEO & Metadata
- Use Next.js Metadata API for page-specific metadata
- Implement proper OpenGraph and Twitter card support
- Use structured data (JSON-LD) for enhanced search results
- Ensure semantic HTML for better search engine crawling

### Testing Strategy
- **Component Tests**: Test UI components in isolation with various props
- **Integration Tests**: Verify interactions between components and API services
- **End-to-end Tests**: Simulate user flows across the application
- **Visual Regression Tests**: Ensure design consistency and prevent unintended UI changes

## Troubleshooting

### Common Issues
- **Hydration Errors**: Check for mismatches between server and client-rendered content
- **tRPC Errors**: Verify API endpoint availability and request payloads
- **Authentication Issues**: Ensure proper environment variable configuration and session management
- **Styling Conflicts**: Check Tailwind CSS configuration and class name merging

### Debugging Tools
- **React Query Devtools**: Inspect query cache, mutations, and API responses
- **Next.js Dev Toolbar**: Analyze build information and rendering strategies
- **Browser DevTools**: Debug components, network requests, and performance
- **tRPC Logger**: Enable detailed logging for API requests and responses