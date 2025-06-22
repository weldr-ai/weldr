# Weldr Web - Cursor Rules

## App Overview
The Weldr Web app is a Next.js application providing the user interface for the Weldr development platform. It features project management, AI chat interfaces, visual editors, and user authentication.

## Technology Stack
- **Framework**: Next.js 15.x with App Router
- **UI**: shadcn/ui + Radix primitives + Tailwind CSS
- **State Management**: tRPC + TanStack Query
- **Auth**: Better Auth with session management
- **AI**: Multiple AI providers (Anthropic, OpenAI, Google)
- **Editor**: Lexical rich text editor
- **Drag & Drop**: @dnd-kit for interactive interfaces
- **Deployment**: Next.js deployment ready

## Architecture Patterns

### App Router Structure
- Use App Router for all new routes
- Implement proper loading.tsx and error.tsx files
- Use route groups for organization
- Follow Next.js conventions for special files

### Components Architecture
- Use shadcn/ui as the base component library
- Build composite components in `src/components/`
- Keep components focused and reusable
- Use proper TypeScript props interfaces

### State Management
- Use tRPC for server state with TanStack Query
- Implement optimistic updates where appropriate
- Use React state for local component state
- Use context for shared client state when needed

## Code Organization

### Directory Structure
- `src/app/` - Next.js App Router pages and layouts
- `src/components/` - Reusable UI components
- `src/lib/` - Utility functions and configurations
- `src/hooks/` - Custom React hooks
- `src/types/` - TypeScript type definitions

### Component Guidelines
- Use React Server Components by default
- Add 'use client' only when necessary
- Implement proper loading and error states
- Use React.forwardRef for ref-forwarding components
- Export TypeScript interfaces for component props

### API Integration
- Use tRPC for type-safe API calls
- Implement proper error handling with toast notifications
- Use optimistic updates for better UX
- Cache data appropriately with TanStack Query

## UI/UX Guidelines

### Design System
- Follow the established design tokens and spacing
- Use consistent color schemes and typography
- Implement proper accessibility (ARIA labels, keyboard navigation)
- Support both light and dark themes

### Responsive Design
- Use Tailwind's responsive prefixes consistently
- Test on mobile, tablet, and desktop viewports
- Implement proper touch interactions for mobile
- Use appropriate breakpoints for layout changes

### User Experience
- Provide immediate feedback for user actions
- Implement proper loading states and skeletons
- Use toast notifications for success/error feedback
- Ensure smooth animations and transitions

## Development Guidelines

### Performance
- Use Next.js Image component for all images
- Implement proper code splitting and lazy loading
- Optimize bundle size with dynamic imports
- Use proper caching strategies for static assets

### SEO & Meta
- Implement proper meta tags for all pages
- Use Next.js Metadata API
- Add structured data where appropriate
- Ensure proper OpenGraph and Twitter card support

### Authentication
- Use Better Auth for all authentication flows
- Implement proper session management
- Handle authentication errors gracefully
- Protect routes with appropriate middleware

### AI Features
- Stream AI responses for better UX
- Implement proper error handling for AI operations
- Use optimistic UI updates for chat interfaces
- Handle AI provider rate limits gracefully

## Integration Guidelines

### tRPC Integration
- Use proper TypeScript types from API package
- Implement error boundaries for tRPC errors
- Use proper query invalidation strategies
- Handle offline scenarios gracefully

### Database Integration
- Use server actions for data mutations when appropriate
- Implement proper data validation
- Use proper error handling for database operations
- Consider data consistency across the application

## AI Assistant Guidelines
When working on the web app:
- Use Next.js App Router patterns consistently
- Prioritize user experience and accessibility
- Implement proper TypeScript types for all components
- Use the established component library patterns
- Consider mobile-first responsive design
- Implement proper loading and error states
- Use tRPC for all server communication
- Follow the established authentication patterns
- Test UI components thoroughly
