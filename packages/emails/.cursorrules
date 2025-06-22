# @weldr/emails - Cursor Rules

## Package Overview
The Emails package provides React-based email templates for the Weldr platform. It includes templates for authentication workflows, notifications, and user communications with proper styling and responsive design.

## Technology Stack
- **React**: Component-based email templates
- **TypeScript**: Type-safe template development
- **Email-safe CSS**: Inline styles and table-based layouts
- **Resend Integration**: Email delivery service compatibility

## Architecture Patterns

### Template Organization
- One component per email template
- Use descriptive names for template files
- Implement proper TypeScript interfaces for props
- Export templates with proper type definitions

### Email-Safe Development
- Use table-based layouts for maximum compatibility
- Implement inline CSS for styling
- Avoid modern CSS features not supported in email clients
- Test across multiple email clients

### Responsive Design
- Use media queries sparingly and test thoroughly
- Implement mobile-first design principles
- Use appropriate fallbacks for older clients
- Consider text-only email alternatives

## Code Organization

### Template Structure
```typescript
// Template pattern
interface TemplateProps {
  // Define props with proper types
}

export const TemplateName = (props: TemplateProps) => {
  return (
    // Email-safe HTML structure
  );
};
```

### Template Files (`src/templates/`)
- `reset-password.tsx` - Password reset email
- `verification-email.tsx` - Email verification
- Add new templates following the same pattern

### Styling Guidelines
- Use inline styles for maximum compatibility
- Implement consistent color schemes and typography
- Use web-safe fonts with proper fallbacks
- Maintain brand consistency across all templates

## Development Guidelines

### Email Client Compatibility
- Test templates in major email clients (Gmail, Outlook, Apple Mail)
- Use email testing tools for comprehensive testing
- Implement proper fallbacks for unsupported features
- Consider dark mode support where possible

### Content Guidelines
- Keep subject lines concise and clear
- Use clear call-to-action buttons
- Implement proper text hierarchy
- Include text alternatives for images

### Accessibility
- Use proper semantic HTML structure
- Implement alt text for all images
- Ensure sufficient color contrast
- Use proper heading structure

### Internationalization
- Design templates to support multiple languages
- Use proper text direction support (RTL/LTR)
- Consider character encoding for international content
- Implement proper date and number formatting

## Template Development

### Common Components
- Create reusable components for headers, footers, buttons
- Use consistent spacing and typography
- Implement proper brand elements
- Create utility functions for common patterns

### Dynamic Content
- Use TypeScript interfaces for template props
- Implement proper data validation
- Handle missing or optional data gracefully
- Use meaningful defaults for optional content

### Testing Strategy
- Test templates with various content lengths
- Validate HTML structure and CSS
- Test email delivery and rendering
- Use email preview tools during development

## Integration Guidelines

### Authentication Integration
- Create templates for all auth workflows
- Include proper branding and messaging
- Implement security best practices in content
- Handle sensitive information appropriately

### Notification Templates
- Design templates for various notification types
- Use consistent visual hierarchy
- Implement proper personalization
- Include relevant action items

### Transactional Emails
- Create templates for system-generated emails
- Include relevant transaction details
- Implement proper receipt and confirmation formats
- Handle error scenarios appropriately

## Performance Guidelines

### Email Size
- Keep email file sizes reasonable
- Optimize images for email delivery
- Use efficient HTML structures
- Consider email client limits

### Delivery Optimization
- Use proper subject lines for deliverability
- Implement proper sender reputation practices
- Include unsubscribe mechanisms where required
- Follow email marketing best practices

## Brand Guidelines

### Visual Identity
- Use consistent brand colors and fonts
- Implement proper logo usage
- Maintain visual hierarchy
- Follow brand guidelines for messaging

### Tone and Voice
- Use consistent tone across all templates
- Implement clear and friendly messaging
- Avoid spam-trigger words and phrases
- Use proper grammar and spelling

## AI Assistant Guidelines
When working on the emails package:
- Use email-safe HTML and CSS practices
- Test templates across multiple email clients
- Implement proper TypeScript interfaces for template props
- Use inline styles for maximum compatibility
- Create responsive designs that work across devices
- Follow accessibility guidelines for email content
- Implement proper brand consistency
- Use clear and actionable content
- Test email delivery and rendering thoroughly
- Consider internationalization requirements
