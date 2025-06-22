# @weldr/auth - Authentication & Subscriptions

## Overview
The Auth package provides comprehensive authentication, authorization, and subscription management for the Weldr platform. It integrates Better Auth with Stripe to deliver a robust and secure user management system.

## Architecture & Technology Stack

### Core Technologies
- **Authentication**: Better Auth for modern authentication flows
- **Subscriptions**: Stripe for payment processing and subscription management
- **Database**: @weldr/db for storing user and subscription data
- **Email Delivery**: Resend for sending transactional emails (e.g., password reset)
- **Email Templates**: @weldr/emails for consistent email branding

### Key Features
- **User Authentication**: Secure sign-up, sign-in, and session management
- **Password Management**: Secure password reset and update flows
- **Email Verification**: Workflow for verifying user email addresses
- **Stripe Integration**:
  - Subscription creation and cancellation
  - Webhook handling for subscription events
  - Feature gating based on subscription status
- **Session Management**: Secure, httpOnly cookie-based sessions
- **Client & Server Utilities**: Provides hooks and helpers for both frontend and backend

## Project Structure

### Core Files
- `src/index.tsx`: Main auth configuration and server-side utilities
- `src/client.ts`: Client-side utilities and React hooks
- `tsconfig.json`: TypeScript configuration for the package

## Available Commands

```bash
pnpm check-types  # Run TypeScript type checking
pnpm clean        # Clean build artifacts and node_modules
```

## Authentication Flow

1.  **User Action**: User initiates sign-in, sign-up, or password reset from the frontend.
2.  **Frontend Forms**: Components from `@weldr/ui` and `@weldr/web` handle user input.
3.  **API Call**: Frontend calls a server action or tRPC endpoint.
4.  **Better Auth**: The backend uses Better Auth to handle the core logic (e.g., creating user, verifying password, generating session).
5.  **Database Interaction**: User data is stored or retrieved from the database via `@weldr/db`.
6.  **Session Cookie**: A secure, httpOnly cookie is set in the user's browser.
7.  **Client State Update**: The frontend is notified of the successful authentication, and the UI updates.

## Subscription Management

### Stripe Webhooks
- A dedicated API endpoint (e.g., `/api/auth/stripe-webhook`) listens for events from Stripe.
- **Events Handled**:
  - `checkout.session.completed`: A new subscription is created.
  - `customer.subscription.updated`: A subscription is changed (e.g., upgraded, downgraded).
  - `customer.subscription.deleted`: A subscription is canceled.
- **Logic**: The webhook handler updates the user's subscription status in the database.

### Feature Gating
- Backend procedures and frontend components can check the user's subscription status.
- This allows for restricting access to premium features based on the user's active subscription.

## Integration with Other Packages

### Web App (`@weldr/web`)
- The web app uses client-side hooks from `src/client.ts` to manage auth state.
- React components use these hooks to conditionally render UI based on whether a user is logged in.
- Server components can access session data to render user-specific content.

### API Layer (`@weldr/api`)
- tRPC's `protectedProcedure` uses session validation logic from this package.
- The API context is populated with user session data for authorized requests.
- API endpoints can check subscription status to authorize access to features.

### Database (`@weldr/db`)
- User and account tables are defined in the `@weldr/db` schema.
- This package interacts with the database to manage user records, sessions, and subscription details.

### Emails (`@weldr/emails`)
- When a user needs to verify their email or reset their password, this package triggers an email to be sent.
- It uses the pre-designed React email templates from `@weldr/emails` for consistent branding.

## Security Best Practices

- **Password Hashing**: Passwords are never stored in plaintext (handled by Better Auth).
- **CSRF Protection**: Better Auth includes measures to prevent Cross-Site Request Forgery.
- **Secure Cookies**: Session cookies are configured as `httpOnly`, `secure`, and `sameSite='lax'`.
- **Input Validation**: All user inputs are validated using Zod schemas (via `@weldr/shared`).
- **Rate Limiting**: Authentication endpoints should have rate limiting to prevent brute-force attacks.

## Development Guidelines

### Adding New Auth Features
1.  Define the required database schema changes in `@weldr/db`.
2.  Implement the core logic using Better Auth in the backend.
3.  Create a new tRPC endpoint in `@weldr/api` if necessary.
4.  Develop the required UI components in `@weldr/ui` and `@weldr/web`.
5.  Add any necessary client-side hooks or utilities in `src/client.ts`.

### Environment Variables
- `AUTH_SECRET`: A secret key for signing session cookies.
- `STRIPE_SECRET_KEY`: Your Stripe secret API key.
- `STRIPE_WEBHOOK_SECRET`: The secret for verifying Stripe webhooks.
- `RESEND_API_KEY`: Your Resend API key for sending emails.
