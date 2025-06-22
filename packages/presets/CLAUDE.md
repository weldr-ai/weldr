# @weldr/presets - Project & Code Generation

## Overview
The Presets package is a powerful code generation engine for the Weldr platform. It provides project templates and scaffolding utilities to rapidly generate new full-stack applications, server backends, or web frontends with predefined configurations and best practices.

## Architecture & Technology Stack

### Core Technologies
- **Templating Engine**: Handlebars for dynamic file generation from templates
- **Configuration**: JSON files for defining project structures and component metadata
- **File System**: Node.js `fs` module for file and directory manipulation
- **Type Safety**: TypeScript for the generator logic

### Key Features
- **Project Scaffolding**: Generate entire project structures from a single command.
- **Code Generation**: Create individual files or components from templates.
- **Multiple Project Types**: Supports `full-stack`, `server-only`, and `web-only` presets.
- **Customizable**: Templates use Handlebars variables for customization.
- **Declarative Definitions**: Project structures and components are defined in easy-to-read JSON files.

## Project Structure

### Base Templates (`src/base/`)
This directory contains the declarative JSON definitions for project structures.
- `packages.json`: Defines dependencies for different project types.
- `server/`: Contains JSON files defining the structure of a server application (routes, middleware, etc.).
- `web/`: Contains JSON files defining the structure of a web application (components, routes, hooks, etc.).

### Generator Logic (`src/generator/`)
- `index.ts`: The main entry point for the code generation logic. It reads the JSON definitions and Handlebars templates to create the final project files.
- `templates/`: This directory contains the Handlebars (`.hbs`) template files. These are the blueprints for the code that will be generated.

**Example Handlebars Template (`server/index.ts.hbs`)**
```typescript
import express from 'express';

const app = express();
const port = {{port}};

app.get('/', (req, res) => {
  res.send('Hello, {{projectName}}!');
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
```

## Available Commands

```bash
pnpm check-types  # Run TypeScript type checking
pnpm clean        # Clean build artifacts
```

## How It Works

1.  **Initiation**: The code generation process is typically triggered by the `@weldr/agent` or a CLI tool.
2.  **Configuration Loading**: The generator reads the JSON definition files from `src/base/` to understand the required file structure, dependencies, and metadata.
3.  **Template Processing**: It then processes the corresponding Handlebars templates from `src/generator/templates/`.
4.  **Variable Injection**: Custom variables (like `projectName`, `port`, etc.) are injected into the Handlebars templates.
5.  **File Creation**: The generator creates the directory structure and writes the processed templates as new files in the target project directory.
6.  **Dependency Installation**: Finally, it can run `pnpm install` to set up the new project's dependencies.

## Development Guidelines

### Creating a New Preset
1.  **Define Structure**: Add or modify JSON files in `src/base/` to define the file structure of the new preset.
2.  **Create Templates**: Add the necessary Handlebars (`.hbs`) files to `src/generator/templates/`. Use Handlebars variables for parts of the code that need to be dynamic.
3.  **Update Generator Logic**: Modify the `src/generator/index.ts` file to handle the new preset type if necessary.

### Best Practices for Templates
- **Keep them minimal**: Templates should provide a solid foundation but not be overly opinionated.
- **Use variables**: Abstract any project-specific names or configurations into Handlebars variables.
- **Include comments**: Add comments to the templates to explain the generated code.
- **Follow best practices**: Ensure the generated code adheres to the overall architectural principles of the Weldr platform (e.g., TypeScript, Biome formatting).

## Integration with Other Packages

- **`@weldr/agent`**: The AI agent is the primary consumer of this package. It uses the presets to scaffold new projects based on user requirements.
- **`@weldr/shared`**: The generator may use utilities from the shared package for tasks like ID generation or validation.

This package is a core component of Weldr's autonomous development capabilities, enabling the rapid creation of new, high-quality projects.
