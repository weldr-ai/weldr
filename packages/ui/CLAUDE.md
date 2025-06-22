# @weldr/ui - UI Component Library

## Overview
The UI package is the official component library for the Weldr platform. It's built following the `shadcn/ui` methodology, which emphasizes composition over configuration. It provides a set of reusable, accessible, and themeable React components.

## Architecture & Technology Stack

### Core Technologies
- **Component Primitives**: Radix UI for accessible, unstyled component primitives
- **Styling**: Tailwind CSS for utility-first styling
- **Component Variants**: Class Variance Authority (CVA) for managing component styles and variants
- **Icons**: Lucide React for a comprehensive and consistent icon set
- **Type Safety**: TypeScript for fully typed component props

### Key Features
- **Composition-based**: Components are designed to be composed together to build complex UIs. You copy and paste the code into your project, giving you full control.
- **Accessible**: Built on top of Radix UI, all components are designed with accessibility (a11y) in mind.
- **Themeable**: Easily themeable using CSS variables for colors, fonts, borders, etc. Supports light and dark modes out of the box.
- **Responsive**: Components are designed to be responsive and work across all screen sizes.
- **Developer Experience**: Comes with a CLI (`add-component`) to easily add new components to your project.

## Project Structure

### Components (`src/components/`)
- This directory contains the source code for all the UI components (e.g., `button.tsx`, `card.tsx`, `dialog.tsx`).
- Components are self-contained and can be copied directly into other applications.

### Hooks (`src/hooks/`)
- Contains custom React hooks that are used by the components or can be used independently.
- `use-toast.ts`: Hook for triggering toast notifications.
- `use-mobile.ts`: Hook for detecting mobile viewports.

### Icons (`src/icons/`)
- Contains custom icon components and re-exports from Lucide React.
- `index.ts` serves as a central export point for all icons.

### Styles (`src/styles/`)
- `globals.css`: Contains the global styles, including all the CSS variables for theming.
- `flow-builder.css`: Specialized styles for the visual workflow builder.

### Utilities (`src/lib/`)
- `utils.tsx`: Contains utility functions, most notably the `cn` function for merging Tailwind CSS classes.

## Available Commands

```bash
pnpm add-component  # CLI to add a new shadcn/ui component to the library
pnpm check-types    # Run TypeScript type checking
pnpm clean          # Clean build artifacts
```

## How to Use Components

### Adding a Component
To add a new component from the official `shadcn/ui` library to this package, you run:
```bash
pnpm add-component <component-name>
```
This will add the component's source code to `src/components/`, making it available for use within the Weldr platform.

### Using a Component
Other packages, primarily `@weldr/web`, consume these components.

```typescript
// Example: Using the Button and Card components in the web app
import { Button } from '@weldr/ui/components/button';
import { Card, CardHeader, CardContent } from '@weldr/ui/components/card';

function MyComponent() {
  return (
    <Card>
      <CardHeader>Welcome!</CardHeader>
      <CardContent>
        <p>This is a card component from our UI library.</p>
        <Button>Click me</Button>
      </CardContent>
    </Card>
  );
}
```

## Theming
- Theming is controlled by CSS variables defined in `src/styles/globals.css`.
- The web application uses `next-themes` to switch between `light` and `dark` class names on the `<html>` element, which in turn applies the correct set of CSS variables.
- To customize the theme, you can modify the color values in the `globals.css` file.

## Development Guidelines

### Creating a New Custom Component
1.  **Follow the Pattern**: Create a new file in `src/components/`. Follow the existing `shadcn/ui` pattern:
    - Use Radix UI primitives for the underlying structure and accessibility.
    - Style it with Tailwind CSS.
    - Use CVA to define variants (size, color, etc.).
    - Export a fully typed React component.
2.  **Accessibility First**: Ensure the component is fully accessible via keyboard and screen readers.
3.  **Forward Refs**: Use `React.forwardRef` to allow parent components to get a ref to the underlying DOM element.
4.  **Use `cn`**: Use the `cn` utility to merge default, variant, and user-provided class names.

**Component Skeleton**
```typescript
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils'; // Assuming utils is in lib

const myComponentVariants = cva(
  'base-styles',
  {
    variants: {
      variant: {
        default: 'default-variant-styles',
        destructive: 'destructive-variant-styles',
      },
      size: {
        default: 'h-10 px-4',
        sm: 'h-9 px-3',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface MyComponentProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof myComponentVariants> {}

const MyComponent = React.forwardRef<HTMLDivElement, MyComponentProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <div
        className={cn(myComponentVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
MyComponent.displayName = 'MyComponent';

export { MyComponent, myComponentVariants };
```

### Integration
- When components from this package are used in `@weldr/web`, the Tailwind CSS configuration from the UI package must be imported into the web app's `tailwind.config.js` to ensure styles are applied correctly.
- The `globals.css` file must also be imported into the web app's main layout file.