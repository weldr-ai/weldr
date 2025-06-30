import { Logger } from "@/lib/logger";
import type { WorkflowContext } from "@/workflow/context";
import { db } from "@weldr/db";
import { declarations } from "@weldr/db/schema";
import type { DeclarationData } from "@weldr/shared/types/declarations";
import { generateObject } from "ai";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { registry } from "../utils/registry";
import type { BackgroundJob, JobResult } from "./background-jobs";

// Schema for semantic enrichment data
const semanticDataSchema = z.object({
  summary: z.string().describe("A concise summary of what this declaration does"),
  purpose: z.string().describe("The main purpose or role of this declaration in the codebase"),
  complexity: z.enum(["low", "medium", "high"]).describe("Complexity level of this declaration"),
  category: z.string().describe("Category or domain this declaration belongs to (e.g., 'authentication', 'ui', 'data')"),
  tags: z.array(z.string()).describe("Relevant tags for categorization and search"),
  relationships: z.array(z.object({
    type: z.enum(["uses", "extends", "implements", "calls", "returns"]),
    target: z.string().describe("What this declaration relates to"),
    description: z.string().describe("Description of the relationship")
  })).describe("Semantic relationships with other code elements"),
  businessValue: z.string().describe("Business or functional value this declaration provides"),
  technicalNotes: z.array(z.string()).describe("Important technical considerations or notes"),
  suggestedImprovements: z.array(z.string()).describe("Potential improvements or refactoring suggestions"),
});

export type SemanticData = z.infer<typeof semanticDataSchema>;

export interface SemanticEnrichmentJobData {
  declarationId: string;
  declarationData: DeclarationData;
  projectId: string;
  versionId: string;
  filePath: string;
  sourceCode: string;
}

export class SemanticEnricher {
  private readonly logger: ReturnType<typeof Logger.get>;

  constructor() {
    this.logger = Logger.get({ tags: ["SemanticEnricher"] });
  }

  /**
   * Process a semantic enrichment job
   */
  async processEnrichmentJob(job: BackgroundJob<SemanticEnrichmentJobData>): Promise<JobResult<SemanticData>> {
    const { declarationId, declarationData, projectId, filePath, sourceCode } = job.data;

    this.logger.info(`Processing semantic enrichment for declaration: ${declarationId}`, {
      extra: { 
        declarationType: declarationData.type,
        declarationName: declarationData.name,
        filePath 
      }
    });

    try {
      // Generate semantic data using a cheap model (GPT-4o-mini or similar)
      const semanticData = await this.generateSemanticData({
        declarationData,
        filePath,
        sourceCode,
        projectId,
      });

      // Update the declaration with semantic data
      await this.saveSemanticData(declarationId, semanticData);

      this.logger.info(`Successfully enriched declaration: ${declarationId}`, {
        extra: { 
          complexity: semanticData.complexity,
          category: semanticData.category,
          tagsCount: semanticData.tags.length
        }
      });

      return {
        success: true,
        data: semanticData,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to enrich declaration: ${declarationId}`, {
        extra: { error: errorMessage }
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Generate semantic data using AI
   */
  private async generateSemanticData({
    declarationData,
    filePath,
    sourceCode,
    projectId,
  }: {
    declarationData: DeclarationData;
    filePath: string;
    sourceCode: string;
    projectId: string;
  }): Promise<SemanticData> {
    // Get relevant context from the source code around the declaration
    const context = this.extractDeclarationContext(sourceCode, declarationData);

    // Create a prompt for semantic analysis
    const prompt = this.createSemanticAnalysisPrompt({
      declarationData,
      filePath,
      context,
      projectId,
    });

    // Use a cheap model for semantic analysis (GPT-4o-mini equivalent)
    const result = await generateObject({
      model: registry.languageModel("openai:gpt-4o-mini"),
      schema: semanticDataSchema,
      prompt,
      temperature: 0.3, // Lower temperature for more consistent results
    });

    return result.object;
  }

  /**
   * Extract relevant context around a declaration from source code
   */
  private extractDeclarationContext(sourceCode: string, declarationData: DeclarationData): string {
    const lines = sourceCode.split('\n');
    const startLine = Math.max(0, (declarationData.location?.start?.line ?? 1) - 5);
    const endLine = Math.min(lines.length - 1, (declarationData.location?.end?.line ?? lines.length) + 5);
    
    return lines.slice(startLine, endLine + 1).join('\n');
  }

  /**
   * Create a semantic analysis prompt
   */
  private createSemanticAnalysisPrompt({
    declarationData,
    filePath,
    context,
    projectId,
  }: {
    declarationData: DeclarationData;
    filePath: string;
    context: string;
    projectId: string;
  }): string {
    return `Analyze the following code declaration and provide semantic enrichment data.

**Project Context:**
- Project ID: ${projectId}
- File Path: ${filePath}
- Declaration Type: ${declarationData.type}
- Declaration Name: ${declarationData.name}

**Declaration Details:**
${JSON.stringify(declarationData, null, 2)}

**Code Context:**
\`\`\`typescript
${context}
\`\`\`

**Instructions:**
Analyze this declaration and provide semantic enrichment data including:
1. A clear summary of what this declaration does
2. Its purpose in the codebase
3. Complexity assessment (low/medium/high)
4. Appropriate category/domain classification
5. Relevant tags for search and categorization
6. Semantic relationships with other code elements
7. Business or functional value it provides
8. Technical considerations and notes
9. Potential improvements or refactoring suggestions

Focus on being accurate and helpful for developers who need to understand and work with this code.
Consider the declaration type (${declarationData.type}) and provide analysis appropriate for that type.

For functions: focus on what they do, their inputs/outputs, side effects
For classes: focus on their responsibility, key methods, inheritance
For types/interfaces: focus on their structure, usage patterns, relationships
For constants/variables: focus on their purpose, scope, mutability
For components (React): focus on their UI purpose, props, state, interactions`;
  }

  /**
   * Save semantic data to the database
   */
  private async saveSemanticData(declarationId: string, semanticData: SemanticData): Promise<void> {
    await db
      .update(declarations)
      .set({
        semanticData: semanticData as unknown as Record<string, unknown>,
      })
      .where(eq(declarations.id, declarationId));
  }

  /**
   * Get semantic data for a declaration
   */
  async getSemanticData(declarationId: string): Promise<SemanticData | null> {
    const declaration = await db.query.declarations.findFirst({
      where: eq(declarations.id, declarationId),
      columns: {
        semanticData: true,
      },
    });

    if (!declaration?.semanticData) {
      return null;
    }

    try {
      return semanticDataSchema.parse(declaration.semanticData);
    } catch {
      // If parsing fails, return null (data might be in old format)
      return null;
    }
  }

  /**
   * Check if a declaration has been semantically enriched
   */
  async isEnriched(declarationId: string): Promise<boolean> {
    const semanticData = await this.getSemanticData(declarationId);
    return semanticData !== null;
  }
}