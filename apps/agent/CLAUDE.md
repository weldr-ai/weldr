# Agent Application Development Guidelines

## Overview
The Agent application is the core AI-powered backend service built with Hono and OpenAPI. It handles code generation, project planning, and integration management using LLMs with custom tools.

## Type Safety Requirements

### Hono OpenAPI Routes
```typescript
// ALWAYS define routes with proper Zod schemas
import { createRoute, z } from "@hono/zod-openapi";
import { createRouter } from "@/lib/utils";

const route = createRoute({
  method: "post",
  path: "/api/resource",
  summary: "Create resource",
  description: "Detailed description",
  tags: ["Resources"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string(),
            value: z.number(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Success",
      content: {
        "application/json": {
          schema: z.object({
            id: z.string(),
            created: z.boolean(),
          }),
        },
      },
    },
    400: {
      description: "Bad request",
    },
  },
});

const router = createRouter();

router.openapi(route, async (c) => {
  const body = c.req.valid("json");
  // Type-safe body access
  return c.json({ id: "123", created: true });
});
```

### Tool Development
```typescript
// ALWAYS use createTool utility with proper schemas
import { z } from "zod";
import { createTool } from "./utils";

export const myTool = createTool({
  name: "toolName",
  description: "Clear description of what the tool does",
  whenToUse: "When you need to perform specific action",
  inputSchema: z.object({
    param1: z.string().describe("Description of parameter"),
    param2: z.number().optional().describe("Optional parameter"),
  }),
  outputSchema: z.discriminatedUnion("success", [
    z.object({
      success: z.literal(true),
      data: z.string(),
    }),
    z.object({
      success: z.literal(false),
      error: z.string(),
    }),
  ]),
  execute: async ({ input, context }) => {
    // Get context data
    const project = context.get("project");
    const version = context.get("version");
    
    // Initialize logger with context
    const logger = Logger.get({
      projectId: project.id,
      versionId: version.id,
      input,
    });
    
    try {
      // Tool implementation
      const result = await performAction(input);
      
      return {
        success: true as const,
        data: result,
      };
    } catch (error) {
      logger.error("Tool execution failed", { extra: { error } });
      return {
        success: false as const,
        error: error.message,
      };
    }
  },
});
```

### Tool Schema Patterns
```typescript
// ALWAYS use discriminated unions for output schemas
outputSchema: z.discriminatedUnion("success", [
  z.object({
    success: z.literal(true),
    // Success properties
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
  }),
])

// Use descriptive schemas for better AI understanding
inputSchema: z.object({
  path: z.string().describe("The file path to read"),
  encoding: z.enum(["utf-8", "ascii"]).optional().default("utf-8"),
})
```

### Message Handling
- **ALWAYS** validate message content with Zod schemas
- Use proper message role types: 'user' | 'assistant' | 'system'
- Validate attachments and metadata
- Type message content arrays properly

### Stream Processing
```typescript
// ALWAYS use proper types for SSE streams
interface StreamEvent {
  type: 'chunk' | 'error' | 'done';
  data: unknown; // Validate with schema
}

// ALWAYS handle stream errors
stream.on('error', (error: Error) => {
  // Proper error handling
});
```

## Hono-Specific Patterns

### Route Organization
```typescript
// In src/routes/[resource].ts
import { createRoute } from "@hono/zod-openapi";
import { createRouter } from "@/lib/utils";

const router = createRouter();

// Define multiple routes in same file
router.openapi(getRoute, async (c) => { /* ... */ });
router.openapi(postRoute, async (c) => { /* ... */ });
router.openapi(putRoute, async (c) => { /* ... */ });
router.openapi(deleteRoute, async (c) => { /* ... */ });

export default router;
```

### Authentication in Routes
```typescript
import { auth } from "@weldr/auth";

router.openapi(route, async (c) => {
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Use session.user for authenticated operations
});
```

### Error Handling in Hono
```typescript
router.openapi(route, async (c) => {
  try {
    const result = await someOperation();
    return c.json(result);
  } catch (error) {
    if (error instanceof ValidationError) {
      return c.json({ error: error.message }, 400);
    }
    if (error instanceof NotFoundError) {
      return c.json({ error: "Not found" }, 404);
    }
    // Log unexpected errors
    console.error(error);
    return c.json({ error: "Internal server error" }, 500);
  }
});
```

### SSE Streaming with Hono
```typescript
router.openapi(streamRoute, async (c) => {
  const stream = await createSSEStream(streamId, chatId);
  
  return new Response(stream as ReadableStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
```

## AI Agent Guidelines

### Tool Implementation Rules
1. **Single Responsibility**: Each tool does ONE thing well
2. **Input Validation**: ALWAYS use Zod schemas with descriptions
3. **Error Messages**: Provide clear, actionable error messages
4. **Return Types**: Use discriminated unions for success/failure
5. **Context Usage**: Always get project/version from context
6. **Logging**: Use structured logging with Logger.get()

### XML Tool Support
```typescript
// Tools support both JSON and XML formats
const tool = myTool(context); // JSON format
const xmlTool = myTool.asXML(context); // XML format
const markdown = myTool.toMarkdown(); // Documentation format
```

### Declaration Extraction
- Use AST parsing for accurate code analysis
- Track dependencies between declarations
- Maintain declaration metadata with proper types
- Use enrichment for additional context

## Integration System

### Adding New Integrations
1. Define integration schema in `/integrations/types.ts`
2. Create category with `defineIntegrationCategory`
3. Implement integration with `defineIntegration`
4. Add to registry with proper typing
5. Validate all configuration with Zod

### Integration Security
- **NEVER** expose API keys in responses
- Store secrets in vault with encryption
- Use environment variable mappings
- Validate integration status before use

## Workflow Engine

### Step Implementation
```typescript
// ALWAYS type workflow steps
interface StepContext {
  projectId: string;
  versionId: string;
  messages: ChatMessage[];
}

export const myStep: WorkflowStep<StepContext> = {
  name: 'myStep',
  execute: async (context) => {
    // Type-safe implementation
  },
};
```

### Workflow Context Pattern
```typescript
// Access workflow context in tools
const project = context.get("project");
const version = context.get("version");
const chatId = context.get("chatId");
const messages = context.get("messages");
```

## File Operations

### Safe File Handling
```typescript
// ALWAYS use WORKSPACE_DIR constant
import { WORKSPACE_DIR } from "@/lib/constants";

const safePath = path.resolve(WORKSPACE_DIR, userInput);
if (!safePath.startsWith(WORKSPACE_DIR)) {
  throw new Error('Path traversal attempt');
}

// ALWAYS handle file errors
try {
  const content = await fs.readFile(filePath, 'utf-8');
} catch (error) {
  if (error.code === 'ENOENT') {
    // File not found handling
  }
  throw error;
}
```

### Command Execution
```typescript
// Use runCommand utility for shell commands
import { runCommand } from "@/lib/commands";

const { stdout, stderr, exitCode } = await runCommand("command", args, {
  cwd: WORKSPACE_DIR,
});

if (exitCode !== 0) {
  // Handle command failure
}
```

## OpenAPI Documentation

### Route Documentation Best Practices
```typescript
const route = createRoute({
  method: "post",
  path: "/api/v1/resource",
  summary: "Brief one-line summary",
  description: "Detailed multi-line description explaining the endpoint",
  tags: ["Category"],
  request: {
    params: z.object({
      id: z.string().openapi({ 
        description: "Resource identifier",
        example: "res_123"
      }),
    }),
    query: z.object({
      limit: z.number().optional().openapi({
        description: "Number of items to return",
        example: 10
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: requestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Successful response",
      content: {
        "application/json": {
          schema: responseSchema,
        },
      },
    },
    // Define all possible response codes
  },
});
```

## Testing Guidelines

### Testing Tools
```typescript
describe('ToolName', () => {
  const mockContext = new WorkflowContext({
    project: { id: "test" },
    version: { id: "v1" },
  });
  
  it('should validate input schema', () => {
    const tool = myTool(mockContext);
    const result = tool.inputSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });
  
  it('should execute successfully', async () => {
    const tool = myTool(mockContext);
    const result = await tool.execute(validInput);
    expect(result.success).toBe(true);
  });
});
```

## Performance Optimization

### Streaming Best Practices
- Use TransformStream for efficient processing
- Implement backpressure handling
- Stream large responses incrementally
- Clean up streams on client disconnect

### Caching Strategy
- Cache declaration extractions
- Use memory cache for frequent lookups
- Implement cache invalidation
- Monitor cache hit rates

## Monitoring & Logging

### Structured Logging
```typescript
import { Logger } from "@weldr/shared/logger";

const logger = Logger.get({
  projectId,
  versionId,
  chatId,
});

logger.info('Operation completed', {
  extra: {
    operationType: 'tool_execution',
    toolName: 'grep',
    duration: Date.now() - startTime,
  },
});
```

### Metrics to Track
- Tool execution times
- LLM token usage
- Error rates by tool
- Stream processing performance
- Integration success rates

## Security Considerations

### Input Sanitization
- Sanitize all file paths
- Validate command arguments
- Escape shell commands properly
- Prevent code injection
- Use WORKSPACE_DIR for path validation

### Resource Limits
- Set timeout for tool execution
- Limit file operation sizes
- Cap LLM token usage
- Rate limit API endpoints

## Common Patterns

### Tool Registry Pattern
```typescript
// Tools are registered automatically via index.ts
export const tools = {
  grep: grepTool,
  readFile: readFileTool,
  writeFile: writeFileTool,
  // ... other tools
};

// Use in agent
const availableTools = Object.values(tools).map(tool => tool(context));
```

### Context Propagation
```typescript
// Pass context through operations
interface OperationContext {
  requestId: string;
  userId: string;
  projectId: string;
  startTime: number;
}

// Use context in all operations
async function performOperation(
  context: OperationContext,
  input: Input
): Promise<Output> {
  // Implementation with context
}
```

## Middleware Usage

### Custom Middleware
```typescript
import { MiddlewareHandler } from "hono";

const loggingMiddleware: MiddlewareHandler = async (c, next) => {
  const start = Date.now();
  await next();
  const duration = Date.now() - start;
  console.log(`${c.req.method} ${c.req.path} - ${duration}ms`);
};

router.use(loggingMiddleware);
```

## Debugging Tips

### Tool Debugging
- Log tool inputs and outputs
- Use structured error messages
- Implement tool replay capability
- Add debug mode for verbose output

### Stream Debugging
- Log stream events
- Monitor chunk sizes
- Track stream lifecycle
- Implement stream replay for testing

## Do's and Don'ts

### Do's
✅ Use createTool utility for all tools
✅ Define discriminated unions for tool outputs
✅ Use Hono's OpenAPI for all routes
✅ Validate all inputs with Zod schemas
✅ Use TypeScript strict mode
✅ Handle all error cases explicitly
✅ Stream large responses
✅ Use Logger.get() for structured logging
✅ Use WORKSPACE_DIR for file operations
✅ Document all API endpoints

### Don'ts
❌ Use `any` type
❌ Create tools without createTool utility
❌ Ignore TypeScript errors
❌ Expose internal errors to users
❌ Block event loop with sync operations
❌ Store secrets in code
❌ Trust user input without validation
❌ Leave console.log in production code
❌ Skip OpenAPI documentation
❌ Access files outside WORKSPACE_DIR