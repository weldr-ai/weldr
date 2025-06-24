# @weldr/ui - Cursor Rules

## Package Overview
The UI package provides a comprehensive component library built on shadcn/ui, Radix primitives, and Tailwind CSS. It includes reusable components, hooks, icons, and styling for the Weldr platform.

## Technology Stack
- **shadcn/ui**: Base component system
- **Radix UI**: Accessible primitive components
- **Tailwind CSS**: Utility-first styling framework
- **Lucide React**: Icon library
- **React Hook Form**: Form handling
- **Recharts**: Data visualization components
- **Class Variance Authority**: Component variant system

## Architecture Patterns

### Component Design
- Build on top of Radix UI primitives
- Use shadcn/ui patterns and conventions
- Implement proper accessibility (ARIA) support
- Follow compound component patterns where appropriate

### Styling Strategy
- Use Tailwind CSS for all styling
- Implement consistent design tokens
- Support light and dark themes
- Use CSS variables for theme customization

### Component Variants
- Use Class Variance Authority (CVA) for component variants
- Implement consistent size and color schemes
- Support disabled and loading states
- Provide proper default variants

## Code Organization

### Component Structure (`src/components/`)
- One component per file with clear naming
- Export component and its types
- Include proper TypeScript interfaces
- Implement proper ref forwarding when needed

### Component Pattern
```typescript
// Component pattern
interface ComponentProps extends React.ComponentProps<'element'> {
  variant?: 'default' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
}

const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant = 'default', size = 'md', ...props }, ref) => {
    return (
      <element
        ref={ref}
        className={cn(componentVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
```

### Styling Organization
- `src/styles/globals.css` - Global styles and CSS variables
- `src/styles/canvas.css` - Specialized component styles
- Use Tailwind classes primarily
- Custom CSS only when necessary

## Development Guidelines

### Component Development
- Use React.forwardRef for components that need ref access
- Implement proper TypeScript types for all props
- Support className prop for additional styling
- Use consistent prop naming conventions

### Accessibility
- Include proper ARIA attributes
- Support keyboard navigation
- Implement proper focus management
- Test with screen readers
- Use semantic HTML elements

### Theme Support
- Support both light and dark themes
- Use CSS variables for theme-dependent values
- Test components in both theme modes
- Implement proper theme transition handling

### Responsive Design
- Use Tailwind responsive prefixes
- Design mobile-first components
- Test across different viewport sizes
- Consider touch interactions for mobile

## Component Guidelines

### Form Components
- Use React Hook Form integration where appropriate
- Implement proper validation error display
- Support controlled and uncontrolled modes
- Include helpful placeholder and label text

### Data Display
- Use Recharts for data visualization
- Implement proper loading and empty states
- Support data formatting and customization
- Include proper legends and tooltips

### Navigation Components
- Use proper semantic markup
- Support active state indicators
- Implement breadcrumb navigation patterns
- Handle route transitions smoothly

### Layout Components
- Use CSS Grid and Flexbox appropriately
- Implement responsive layout patterns
- Support content overflow handling
- Provide proper spacing utilities

## Hook Development (`src/hooks/`)

### Custom Hooks
- Follow React hooks conventions
- Use proper TypeScript types
- Handle cleanup and side effects properly
- Include helpful return value destructuring

### Common Patterns
```typescript
// Hook pattern
export const useHookName = (config: HookConfig) => {
  // Hook implementation
  return {
    // Return useful values and functions
  };
};
```

## Icon System (`src/icons/`)

### Icon Guidelines
- Use Lucide React as the primary icon library
- Create custom icons when needed
- Export icons with consistent naming
- Support proper sizing and coloring
- Include accessibility attributes

### Icon Usage
- Use semantic icon names
- Support theme-appropriate colors
- Implement proper sizing scales
- Consider icon loading performance

## Testing Guidelines

### Component Testing
- Test component rendering with different props
- Test accessibility features
- Test responsive behavior
- Test theme switching
- Test user interactions

### Visual Testing
- Test components in Storybook or similar
- Verify design system consistency
- Test across different browsers
- Validate responsive breakpoints

## Integration Guidelines

### Package Exports
- Export components from package root
- Include proper TypeScript types
- Support tree-shaking
- Document component APIs

### Styling Integration
- Export Tailwind configuration
- Include PostCSS configuration
- Support CSS variable customization
- Provide theme configuration options

### Framework Integration
- Support Next.js and other React frameworks
- Handle SSR and hydration properly
- Support code splitting and lazy loading
- Provide proper build configurations

## Performance Guidelines

### Bundle Optimization
- Use proper tree-shaking for icons and components
- Minimize CSS bundle size
- Optimize component re-renders
- Use proper React.memo when beneficial

### Runtime Performance
- Optimize animation performance
- Use efficient event handlers
- Implement proper virtualization for long lists
- Monitor component render performance

## AI Assistant Guidelines
When working on the UI package:
- Follow shadcn/ui patterns and conventions
- Use Radix UI primitives for complex components
- Implement proper accessibility features
- Use Tailwind CSS for all styling
- Support both light and dark themes
- Use React.forwardRef for ref forwarding components
- Implement proper TypeScript interfaces
- Use Class Variance Authority for component variants
- Test components across different devices and themes
- Follow consistent naming conventions
- Export components with clean interfaces
- Document component APIs and usage patterns
