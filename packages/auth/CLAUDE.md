# @weldr/auth - Cursor Rules

## Package Overview
The Auth package provides authentication and authorization functionality using Better Auth with Stripe integration for subscription management. It handles user registration, login, password reset, email verification, and subscription workflows.

## Technology Stack
- **Better Auth**: Modern authentication library
- **Stripe**: Payment processing and subscription management
- **Resend**: Email delivery service
- **Database**: Integration with @weldr/db
- **Email Templates**: Integration with @weldr/emails

## Architecture Patterns

### Authentication Flow
- Use Better Auth for core authentication logic
- Implement secure session management
- Handle multi-factor authentication when enabled
- Support social login providers when configured

### Authorization Strategy
- Use role-based access control (RBAC)
- Implement subscription-based feature gating
- Use middleware for route protection
- Handle permission checking consistently

### Session Management
- Use secure, httpOnly cookies for sessions
- Implement proper session expiration
- Handle session refresh automatically
- Support multiple active sessions per user

## Code Organization

### Main Exports
- `./` - Main auth configuration and setup
- `./client` - Client-side auth utilities and hooks

### Client-Side Utilities
- Provide React hooks for authentication state
- Implement proper loading states
- Handle authentication errors gracefully
- Support optimistic UI updates

### Server-Side Integration
- Use middleware for protected routes
- Implement proper session validation
- Handle authentication context properly
- Support server-side redirects

## Development Guidelines

### Security Best Practices
- Use secure password hashing (handled by Better Auth)
- Implement proper CSRF protection
- Validate all authentication inputs
- Use secure session storage
- Implement rate limiting for auth endpoints

### Password Management
- Enforce strong password policies
- Implement secure password reset flows
- Use proper email verification
- Handle password change workflows

### Email Integration
- Use @weldr/emails for email templates
- Implement proper email verification flows
- Handle email delivery failures gracefully
- Support email preference management

### Stripe Integration
- Handle subscription lifecycle events
- Implement proper webhook handling
- Sync subscription status with user accounts
- Handle payment failures gracefully

## Configuration Guidelines

### Environment Variables
- Use proper environment variable validation
- Keep sensitive keys secure
- Support multiple environments (dev, staging, prod)
- Document all required configuration

### Database Schema
- Use proper user table structure
- Implement audit trails for auth events
- Handle user data privacy requirements
- Support account deletion workflows

### Email Configuration
- Configure proper sender authentication
- Use branded email templates
- Handle email bounces and complaints
- Implement email analytics when needed

## Integration Guidelines

### Database (@weldr/db)
- Use proper user schema definitions
- Implement user profile management
- Handle user data relationships
- Support user data export/deletion

### Emails (@weldr/emails)
- Use consistent email templates
- Support multiple languages when needed
- Implement proper email styling
- Handle email personalization

### Frontend Integration
- Provide proper TypeScript types
- Implement client-side route protection
- Handle authentication state management
- Support server-side rendering

## Error Handling

### Authentication Errors
- Provide clear error messages for users
- Log security events for monitoring
- Handle account lockouts appropriately
- Support account recovery workflows

### Subscription Errors
- Handle payment processing failures
- Provide clear subscription status
- Support subscription management flows
- Handle subscription cancellations

## Testing Guidelines

### Authentication Testing
- Test all authentication flows
- Validate security measures
- Test session management
- Verify email workflows

### Integration Testing
- Test database integrations
- Verify email delivery
- Test Stripe webhooks
- Validate error scenarios

## AI Assistant Guidelines
When working on the auth package:
- Prioritize security in all authentication features
- Use Better Auth patterns and best practices
- Implement proper input validation and sanitization
- Handle sensitive data with appropriate care
- Test authentication flows thoroughly
- Follow OWASP security guidelines
- Implement proper session management
- Use TypeScript for type safety
- Document security considerations
- Handle edge cases in authentication flows
