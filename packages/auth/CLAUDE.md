# @weldr/auth

Authentication client and utilities package.

## Overview
This package provides authentication functionality using Better Auth with Stripe integration for subscription management.

## Key Dependencies
- `better-auth` - Modern authentication library
- `@better-auth/stripe` - Stripe integration for subscriptions
- `@weldr/db` - Database integration
- `@weldr/emails` - Email templates
- `resend` - Email delivery service
- `stripe` - Payment processing

## Exports
- `.` - Main auth configuration
- `./client` - Client-side auth utilities

## Commands
- Type check: `pnpm check-types`
- Clean: `pnpm clean`

## Features
- User authentication (sign in/up)
- Password reset functionality
- Email verification
- Stripe subscription management
- Session management