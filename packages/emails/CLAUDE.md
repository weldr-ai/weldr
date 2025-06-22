# @weldr/emails - Transactional Email Templates

## Overview
The Emails package provides a set of type-safe, responsive, and consistently branded email templates for the Weldr platform. It uses React to build templates, ensuring a modern and maintainable development experience.

## Architecture & Technology Stack

### Core Technologies
- **Templating**: React for building email components
- **Type Safety**: TypeScript for type-safe template props
- **Email Compatibility**: Utilizes patterns that ensure compatibility across major email clients (e.g., table-based layouts, inline styles).
- **Delivery**: Designed for use with email delivery services like Resend.

### Key Features
- **Responsive Design**: Emails look great on both desktop and mobile clients.
- **Type-Safe Props**: Each template has a defined TypeScript interface for its props, preventing errors when sending emails.
- **Consistent Branding**: Ensures all platform emails have a consistent look and feel.
- **Maintainable**: Using React components makes it easy to update and create new templates.

## Project Structure

### Template Directory (`src/templates/`)
- This directory contains all the individual email templates.
- **`reset-password.tsx`**: Template for the password reset workflow.
- **`verification-email.tsx`**: Template for verifying a user's email address.
- **Future templates** for notifications, invoices, etc., will be added here.

### Template Component Pattern
Each template is a React component that accepts props and returns email-safe HTML.

```typescript
import * as React from 'react';

// Define the props for the template
interface ResetPasswordEmailProps {
  resetLink: string;
  userName: string;
}

// The React component for the email template
export const ResetPasswordEmail: React.FC<ResetPasswordEmailProps> = ({
  resetLink,
  userName,
}) => (
  <html>
    {/* Email-safe HTML and inline styles go here */}
    <body>
      <p>Hi {userName},</p>
      <p>
        Click <a href={resetLink}>here</a> to reset your password.
      </p>
    </body>
  </html>
);
```

## Available Commands

```bash
pnpm check-types  # Run TypeScript type checking
pnpm clean        # Clean build artifacts
```

## Development Guidelines

### Creating a New Email Template
1.  **Create File**: Add a new `.tsx` file in `src/templates/`.
2.  **Define Props**: Create a TypeScript interface for the template's props.
3.  **Build Component**: Create a React component that renders email-safe HTML.
4.  **Styling**: Use inline CSS styles for maximum compatibility. Avoid modern CSS properties that are not widely supported in email clients.
5.  **Export**: Export the component from the file.

### Email Development Best Practices
- **Layouts**: Use `<table>` elements for robust, responsive layouts.
- **Styling**: Always use inline `style` attributes. Avoid `<style>` blocks or external stylesheets.
- **Images**: Use absolute URLs for all images and include `alt` text for accessibility.
- **Links**: Ensure all links are absolute URLs.
- **Testing**: Test templates across major email clients (Gmail, Outlook, Apple Mail) using tools like Litmus or Email on Acid if possible.

## Integration with Other Packages

### `resend` and `@weldr/auth`
- The `@weldr/auth` package is the primary consumer of these email templates.
- When an authentication event occurs (e.g., a user signs up or requests a password reset), the auth package will:
  1.  Import the required email template component.
  2.  Render the React component to an HTML string.
  3.  Use an email delivery service like `resend` to send the generated HTML.

**Example Usage (conceptual)**
```typescript
// In a service within @weldr/auth or @weldr/api
import { resend } from './resend-client';
import { render } from '@react-email/render';
import { VerificationEmail } from '@weldr/emails/templates/verification-email';

async function sendVerificationEmail(email: string, link: string) {
  const emailHtml = render(
    <VerificationEmail verificationLink={link} />
  );

  await resend.emails.send({
    from: 'Weldr <noreply@weldr.dev>',
    to: email,
    subject: 'Verify your email address',
    html: emailHtml,
  });
}
```

### Environment Variables
- `RESEND_API_KEY`: The API key for the Resend email delivery service. This is typically used in the package that *sends* the email (e.g., `@weldr/auth`), not in the `@weldr/emails` package itself.
