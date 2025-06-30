# Semantic Enrichment System

This document describes the semantic enrichment system that automatically enhances extracted code declarations with semantic metadata using AI models.

## Overview

The semantic enrichment system is a background job processing system that:

1. **Automatically processes** declarations extracted from code files
2. **Uses cheap AI models** (like GPT-4o-mini) to generate semantic metadata
3. **Runs non-blocking** in the background with retry handling
4. **Stores enriched data** in the database for improved code understanding

## Architecture

### Core Components

1. **BackgroundJobQueue** (`apps/agent/src/ai/services/background-jobs.ts`)
   - Redis-based job queue with priority support
   - Automatic retry with exponential backoff
   - Job status tracking and monitoring
   - Graceful error handling

2. **SemanticEnricher** (`apps/agent/src/ai/services/semantic-enricher.ts`)
   - AI-powered semantic analysis using cheap models
   - Generates structured semantic metadata
   - Handles different declaration types appropriately

3. **DeclarationEnrichmentManager** (`apps/agent/src/ai/services/enrichment-manager.ts`)
   - Coordinates the enrichment process
   - Manages job queuing and processing
   - Provides status and monitoring APIs

### Data Flow

```
Code File Changes
      ↓
Declaration Extraction (existing)
      ↓
Queue Semantic Enrichment Jobs (non-blocking)
      ↓
Background Job Processing
      ↓
AI Semantic Analysis
      ↓
Store Enriched Data in Database
```

## Semantic Data Structure

The system generates the following semantic metadata for each declaration:

```typescript
interface SemanticData {
  summary: string;                    // Concise summary of functionality
  purpose: string;                    // Main purpose in the codebase
  complexity: "low" | "medium" | "high"; // Complexity assessment
  category: string;                   // Domain category (e.g., "auth", "ui")
  tags: string[];                     // Searchable tags
  relationships: Array<{              // Semantic relationships
    type: "uses" | "extends" | "implements" | "calls" | "returns";
    target: string;
    description: string;
  }>;
  businessValue: string;              // Business/functional value
  technicalNotes: string[];           // Technical considerations
  suggestedImprovements: string[];    // Potential improvements
}
```

## Integration Points

### Automatic Enrichment

The system automatically queues enrichment jobs when:
- New declarations are extracted from code files
- Files are edited or created via the edit/write tools

### Database Schema

The `declarations` table includes a new `semanticData` JSONB field:

```sql
ALTER TABLE declarations ADD COLUMN semantic_data JSONB;
```

### API Endpoints

- `GET /enrichment/stats` - Queue statistics
- `GET /enrichment/declaration/:id` - Declaration enrichment status
- `GET /enrichment/job/:id` - Job status

## Configuration

### Environment Variables

- `OPENAI_API_KEY` - Required for AI semantic analysis
- `REDIS_URL` - Redis connection for job queue (defaults to localhost)

### Model Selection

The system uses `openai:gpt-4o-mini` by default for cost-effective semantic analysis. This can be changed in the `SemanticEnricher` class.

## Monitoring and Operations

### Job Queue Statistics

```bash
# Get queue stats
curl http://localhost:8080/enrichment/stats

# Response:
{
  "success": true,
  "data": {
    "queued": 5,
    "processing": 1,
    "completed": 23,
    "failed": 0
  }
}
```

### Declaration Status

```bash
# Check if a declaration is enriched
curl http://localhost:8080/enrichment/declaration/{declaration-id}

# Response:
{
  "success": true,
  "data": {
    "isEnriched": true,
    "semanticData": {
      "summary": "User authentication service...",
      "complexity": "medium",
      // ... full semantic data
    }
  }
}
```

## Error Handling

The system includes comprehensive error handling:

1. **Non-blocking**: Enrichment failures don't affect the main declaration extraction
2. **Retry Logic**: Failed jobs are retried up to 3 times with exponential backoff
3. **Graceful Degradation**: The system continues working even if AI services are unavailable
4. **Monitoring**: All errors are logged with appropriate context

## Performance Considerations

- **Cheap Models**: Uses cost-effective models like GPT-4o-mini
- **Background Processing**: Doesn't block the main application flow
- **Batch Processing**: Processes multiple declarations efficiently
- **Caching**: Avoids re-enriching already processed declarations
- **Redis Queue**: Efficient job scheduling and processing

## Future Enhancements

Potential improvements:

1. **Embedding Generation**: Generate vector embeddings for semantic search
2. **Batch Processing**: Process multiple declarations in a single AI call
3. **Model Selection**: Dynamic model selection based on declaration complexity
4. **Semantic Search**: Use enriched data for improved code search
5. **Code Recommendations**: Suggest related code based on semantic relationships

## Troubleshooting

### Common Issues

1. **Jobs stuck in queue**: Check Redis connection and AI API keys
2. **High failure rate**: Verify AI model availability and rate limits
3. **Memory usage**: Monitor Redis memory usage for large projects

### Debugging

Enable debug logging by setting the log level:

```bash
# Check enrichment manager logs
grep "DeclarationEnrichmentManager" logs/app.log

# Check semantic enricher logs
grep "SemanticEnricher" logs/app.log
```

## Development

### Running Tests

```bash
# Run enrichment system tests
pnpm test apps/agent/src/ai/services/

# Test with real AI models (requires API keys)
pnpm test:integration
```

### Local Development

The enrichment system requires Redis and AI API keys for full functionality:

```bash
# Start Redis locally
docker run -p 6379:6379 redis:latest

# Set environment variables
export OPENAI_API_KEY=your_key_here
export REDIS_URL=redis://localhost:6379

# Start the agent
pnpm dev
```