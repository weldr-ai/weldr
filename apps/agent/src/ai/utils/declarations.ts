import { inArray } from "drizzle-orm";

import { and, db, eq } from "@weldr/db";
import {
  declarations,
  dependencies,
  nodes,
  type tasks,
  versionDeclarations,
} from "@weldr/db/schema";
import type { Tx } from "@weldr/db/types";
import { mergeJson } from "@weldr/db/utils";
import { Logger } from "@weldr/shared/logger";
import { nanoid } from "@weldr/shared/nanoid";
import type { DeclarationCodeMetadata } from "@weldr/shared/types/declarations";

import { extractDeclarations } from "@/lib/extract-declarations";
import { stream } from "@/lib/stream-utils";
import type { WorkflowContext } from "@/workflow/context";
import { queueEnrichingJob } from "./enriching-jobs";

const NODE_DIMENSIONS = {
  page: { width: 400, height: 300 },
  endpoint: { width: 256, height: 128 },
  "db-model": { width: 300, height: 250 },
  default: { width: 300, height: 200 },
};

const PLACEMENT_CONFIG = {
  gap: 50,
  maxCanvasWidth: 2000,
  xStep: 150,
  yStep: 150,
};

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Checks if two rectangles intersect, accounting for a gap buffer around each rectangle.
 *
 * @param a - First rectangle with position (x, y) and dimensions (width, height)
 * @param b - Second rectangle with position (x, y) and dimensions (width, height)
 * @returns True if the rectangles overlap (including gap buffer), false otherwise
 */
const intersects = (a: Rect, b: Rect): boolean => {
  return (
    a.x < b.x + b.width + PLACEMENT_CONFIG.gap &&
    a.x + a.width + PLACEMENT_CONFIG.gap > b.x &&
    a.y < b.y + b.height + PLACEMENT_CONFIG.gap &&
    a.y + a.height + PLACEMENT_CONFIG.gap > b.y
  );
};

/**
 * Creates or updates a declaration from a task, managing canvas nodes and version associations.
 *
 * This function handles two operations:
 * - **Create**: Places a new canvas node at a non-overlapping position and creates a new declaration
 * - **Update**: Finds the existing declaration by URI, removes old version links, and creates a new declaration
 *
 * For create operations, the function:
 * 1. Fetches all existing canvas nodes to determine occupied positions
 * 2. Finds a non-overlapping position using collision detection with a gap buffer
 * 3. Creates a new canvas node at that position
 * 4. Creates a declaration linked to the node
 *
 * For update operations, the function:
 * 1. Finds the existing declaration by URI in the current version
 * 2. Removes the version-declaration link for the old declaration
 * 3. Retrieves the associated canvas node
 * 4. Creates a new declaration linked to the same node, with a reference to the previous declaration
 *
 * @param context - Workflow context containing project, branch, version, and user information
 * @param task - Task object containing operation details (create/update) and specifications
 * @param tx - Optional database transaction to use; if not provided, creates a new one
 * @returns The created declaration with its dependencies, or null if task is not a declaration type
 * @throws Error if canvas node creation fails, declaration not found (for updates), or declaration creation fails
 */
export const createDeclarationFromTask = async ({
  context,
  task,
  tx,
}: {
  context: WorkflowContext;
  task: typeof tasks.$inferSelect;
  tx?: Tx;
}) => {
  const project = context.get("project");
  const branch = context.get("branch");
  const user = context.get("user");

  const logger = Logger.get({
    projectId: project.id,
    versionId: branch.headVersion.id,
  });

  const taskData = task.data;

  if (taskData.type !== "declaration") {
    return null;
  }

  const dbInstance = tx ?? db;

  return await dbInstance.transaction(async (tx) => {
    let node: typeof nodes.$inferSelect | undefined;
    let previousDeclarationId: string | null = null;

    if (taskData.operation === "create") {
      const existingNodes = await tx.query.nodes.findMany({
        where: eq(nodes.projectId, project.id),
        with: {
          declaration: {
            columns: {
              metadata: true,
            },
          },
        },
      });

      const allRects: Rect[] = existingNodes.map((node) => {
        const type =
          (node.declaration?.metadata?.codeMetadata
            ?.type as keyof typeof NODE_DIMENSIONS) ?? "default";
        const dimensions = NODE_DIMENSIONS[type] || NODE_DIMENSIONS.default;
        return {
          x: node.position.x,
          y: node.position.y,
          ...dimensions,
        };
      });

      const type =
        (taskData.specs.type as keyof typeof NODE_DIMENSIONS) ?? "default";
      const dimensions = NODE_DIMENSIONS[type] || NODE_DIMENSIONS.default;

      const nextPos = { x: 0, y: 0 };
      let hasCollision = true;
      while (hasCollision) {
        const candidateRect: Rect = { ...nextPos, ...dimensions };
        hasCollision = allRects.some((rect) => intersects(candidateRect, rect));

        if (hasCollision) {
          nextPos.x += PLACEMENT_CONFIG.xStep;
          if (nextPos.x > PLACEMENT_CONFIG.maxCanvasWidth) {
            nextPos.x = 0;
            nextPos.y += PLACEMENT_CONFIG.yStep;
          }
        }
      }

      const [createdCanvasNode] = await tx
        .insert(nodes)
        .values({
          projectId: project.id,
          position: nextPos,
        })
        .returning();

      if (!createdCanvasNode) {
        logger.error("Failed to create canvas node");
        throw new Error(
          `[createDeclarationFromTask:project_${project.id}:version_${branch.headVersion.id}] Failed to create canvas node`,
        );
      }

      node = createdCanvasNode;
    }

    if (taskData.operation === "update") {
      const existingVersionDeclarations =
        await tx.query.versionDeclarations.findMany({
          where: eq(versionDeclarations.versionId, branch.headVersion.id),
          with: {
            declaration: {
              columns: {
                id: true,
                uri: true,
                nodeId: true,
              },
            },
          },
        });

      const existingDeclaration = existingVersionDeclarations
        .map((d) => d.declaration)
        .find((d) => d?.uri === taskData.uri);

      if (!existingDeclaration) {
        logger.error("Declaration not found");
        throw new Error(
          `[createDeclarationFromTask:project_${project.id}:version_${branch.headVersion.id}] Declaration URI ${taskData.uri} not found, please make sure the declaration exists.`,
        );
      }

      if (!existingDeclaration.nodeId) {
        logger.error("Node ID not found");
        throw new Error(
          `[createDeclarationFromTask:project_${project.id}:version_${branch.headVersion.id}] Node ID not found, please make sure the node exists.`,
        );
      }

      await tx
        .delete(versionDeclarations)
        .where(eq(versionDeclarations.declarationId, existingDeclaration.id));

      node = await tx.query.nodes.findFirst({
        where: eq(nodes.id, existingDeclaration.nodeId),
      });

      previousDeclarationId = existingDeclaration.id;
    }

    const [createdDeclaration] = await tx
      .insert(declarations)
      .values({
        progress: "pending",
        path: taskData.filePath,
        metadata: {
          version: "v1",
          specs: taskData.specs,
        },
        previousId: previousDeclarationId,
        projectId: project.id,
        userId: user.id,
        nodeId: node?.id,
        taskId: task.id,
      })
      .returning();

    if (!createdDeclaration) {
      logger.error("Failed to create declaration");
      throw new Error(
        `[createDeclarationFromTask:project_${project.id}:version_${branch.headVersion.id}] Failed to create declaration`,
      );
    }

    await tx.insert(versionDeclarations).values({
      versionId: branch.headVersion.id,
      declarationId: createdDeclaration.id,
    });

    try {
      if (createdDeclaration.metadata?.specs && node) {
        await stream(branch.headVersion.chatId, {
          type: "node",
          nodeId: node.id,
          position: node.position,
          metadata: createdDeclaration.metadata,
          progress: createdDeclaration.progress,
          node: node,
        });
      }
    } catch (error) {
      logger.warn("Failed to stream node creation", {
        extra: { error, nodeId: node?.id },
      });
    }

    const declarationWithRelations = await tx.query.declarations.findFirst({
      where: eq(declarations.id, createdDeclaration.id),
      with: {
        dependencies: {
          with: {
            dependency: true,
          },
        },
      },
    });

    if (!declarationWithRelations) {
      throw new Error("Failed to fetch created declaration with relations");
    }

    return declarationWithRelations;
  });
};

/**
 * Generates TypeScript path aliases based on the project's integration categories.
 *
 * Path aliases are used to resolve import paths during declaration extraction:
 * - Both frontend + backend: Creates aliases for both `@repo/web/*` and `@repo/server/*`
 * - Backend only: Creates alias for `@repo/server/*`
 * - Frontend only: Creates alias for `@repo/web/*`
 *
 * @param integrationCategories - Set of integration category strings (e.g., "frontend", "backend")
 * @returns Record mapping path alias patterns to their actual file system paths
 */
function getPathAliases(
  integrationCategories: Set<string>,
): Record<string, string> {
  const pathAliases: Record<string, string> = {};

  if (
    integrationCategories.has("frontend") &&
    integrationCategories.has("backend")
  ) {
    pathAliases["@repo/web/*"] = "apps/web/src/*";
    pathAliases["@repo/server/*"] = "apps/server/src/*";
  } else if (integrationCategories.has("backend")) {
    pathAliases["@repo/server/*"] = "apps/server/src/*";
  } else if (integrationCategories.has("frontend")) {
    pathAliases["@repo/web/*"] = "apps/web/src/*";
  }

  return pathAliases;
}

/**
 * Fetches all declarations associated with a specific version.
 *
 * Retrieves the version-declaration links and joins with declaration data including:
 * - Declaration ID, file path, URI
 * - Progress status
 * - Metadata (specs, code metadata)
 * - Associated task ID
 *
 * @param tx - Database transaction object
 * @param versionId - ID of the version to fetch declarations for
 * @returns Array of version-declaration links with their associated declaration data
 */
async function getHeadVersionDeclarations(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  versionId: string,
) {
  return await tx.query.versionDeclarations.findMany({
    where: and(eq(versionDeclarations.versionId, versionId)),
    with: {
      declaration: {
        columns: {
          id: true,
          path: true,
          uri: true,
          progress: true,
          metadata: true,
          taskId: true,
        },
      },
    },
  });
}

type DeclarationOperation =
  | { type: "link"; declarationId: string }
  | { type: "update"; declarationId: string }
  | { type: "create" };

/**
 * Determines what operation should be performed for an extracted declaration.
 *
 * The function follows this decision tree:
 * 1. **Update**: If a declaration with the same URI already exists (either in version declarations or by direct lookup)
 * 2. **Link**: If no URI match exists, but a matching task declaration is found (task-created declarations waiting for code implementation)
 * 3. **Create**: If neither URI match nor task match exists, create a new declaration
 *
 * A "task declaration" is one that:
 * - Has a taskId (created from a task)
 * - Has no URI yet (awaiting code implementation)
 * - Is not completed
 * - Has specs metadata
 * - Is in the same file path
 *
 * The link operation is critical for connecting AI-generated task specs with actual code implementations.
 *
 * @param extractedDeclaration - The declaration extracted from source code
 * @param headVersionDeclarations - All declarations currently in the head version
 * @param existingDeclarationByUri - Result of direct URI lookup in declarations table
 * @param filePath - File path where the declaration was found
 * @param logger - Logger instance for tracking decision process
 * @returns Operation object indicating whether to update, link, or create, along with relevant declaration ID
 */
function determineDeclarationOperation(
  extractedDeclaration: DeclarationCodeMetadata,
  headVersionDeclarations: Array<
    NonNullable<
      Awaited<
        ReturnType<typeof getHeadVersionDeclarations>
      >[number]["declaration"]
    >
  >,
  existingDeclarationByUri: { id: string } | null | undefined,
  filePath: string,
  logger: ReturnType<typeof Logger.get>,
): DeclarationOperation {
  const doesDeclarationExist = headVersionDeclarations.find(
    (d) => extractedDeclaration.uri === d.uri,
  );

  if (doesDeclarationExist || existingDeclarationByUri) {
    const existingId = doesDeclarationExist?.id || existingDeclarationByUri?.id;
    if (!existingId) {
      throw new Error(
        `Expected existing declaration ID but got none for URI: ${extractedDeclaration.uri}`,
      );
    }
    logger.info(
      `Decision: UPDATE existing declaration ${existingId} (matched by URI)`,
    );
    return {
      type: "update",
      declarationId: existingId,
    };
  }

  const matchingTaskDeclaration = findMatchingTaskDeclaration(
    extractedDeclaration,
    headVersionDeclarations,
    filePath,
    logger,
  );

  if (matchingTaskDeclaration) {
    if (!matchingTaskDeclaration.id) {
      throw new Error(
        `Matching task declaration found but ID is missing for URI: ${extractedDeclaration.uri}`,
      );
    }
    logger.info(
      `Decision: LINK to task declaration ${matchingTaskDeclaration.id} (taskId: ${matchingTaskDeclaration.taskId})`,
    );
    return {
      type: "link",
      declarationId: matchingTaskDeclaration.id,
    };
  }

  logger.info(
    `Decision: CREATE new declaration for ${extractedDeclaration.uri} (no match found)`,
  );
  return {
    type: "create",
  };
}

/**
 * Resolves and creates dependency relationships between declarations.
 *
 * Iterates through all extracted declarations and processes their dependencies:
 * - Maps dependency URIs to declaration IDs using the newly created declarations map
 * - Falls back to searching head version declarations if not found in the new map
 * - Creates dependency records in the database linking dependents to their dependencies
 * - Only processes internal dependencies (not external package dependencies)
 *
 * Dependencies are stored in a many-to-many relationship table, allowing:
 * - Tracking which declarations depend on others
 * - Building dependency graphs for impact analysis
 * - Understanding code relationships and coupling
 *
 * @param tx - Database transaction object
 * @param extractedDeclarations - Array of declarations extracted from source code with their dependency information
 * @param declarationUriToIdMap - Map of declaration URIs to their database IDs (for newly created/updated declarations)
 * @param headVersionDeclarations - All declarations currently in the head version (for fallback lookup)
 * @param logger - Logger instance for tracking dependency resolution
 */
async function resolveDependencies(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  extractedDeclarations: DeclarationCodeMetadata[],
  declarationUriToIdMap: Map<string, string>,
  headVersionDeclarations: Awaited<
    ReturnType<typeof getHeadVersionDeclarations>
  >,
  logger: ReturnType<typeof Logger.get>,
): Promise<void> {
  for (const data of extractedDeclarations) {
    const dependentUri = data.uri;
    const dependentId = declarationUriToIdMap.get(dependentUri);

    if (!dependentId) {
      logger.warn(
        `Skipping dependency resolution for ${dependentUri}: declaration ID not found`,
      );
      continue;
    }

    for (const dep of data.dependencies) {
      if (dep.type === "internal") {
        await resolveInternalDependencies(
          tx,
          dependentId,
          dependentUri,
          dep,
          declarationUriToIdMap,
          headVersionDeclarations,
          logger,
        );
      }
    }
  }
}

/**
 * Resolves internal dependencies for a specific declaration and creates dependency records.
 *
 * For each dependency name in the internal dependency object:
 * 1. Constructs the dependency URI as `{filePath}:{declarationName}`
 * 2. Attempts to find the dependency ID in the new declarations map
 * 3. Falls back to searching head version declarations if not found
 * 4. Creates a dependency record linking the dependent to the dependency
 * 5. Uses onConflictDoNothing to safely handle duplicate entries
 *
 * Internal dependencies are imports from other files in the same project.
 * Example: `import { UserModel } from './models/user'` creates an internal dependency
 * on the UserModel declaration.
 *
 * @param tx - Database transaction object
 * @param dependentId - ID of the declaration that has the dependency
 * @param dependentUri - URI of the dependent declaration (for logging)
 * @param dependency - Internal dependency object containing file path and list of dependency names
 * @param declarationUriToIdMap - Map of URIs to IDs for newly processed declarations
 * @param headVersionDeclarations - All declarations in the version (for fallback lookup)
 * @param logger - Logger instance for tracking resolution failures
 */
async function resolveInternalDependencies(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  dependentId: string,
  dependentUri: string,
  dependency: Extract<
    DeclarationCodeMetadata["dependencies"][number],
    { type: "internal" }
  >,
  declarationUriToIdMap: Map<string, string>,
  headVersionDeclarations: Awaited<
    ReturnType<typeof getHeadVersionDeclarations>
  >,
  logger: ReturnType<typeof Logger.get>,
): Promise<void> {
  for (const depName of dependency.dependsOn) {
    const dependencyUri = `${dependency.filePath}:${depName}`;

    let dependencyId = declarationUriToIdMap.get(dependencyUri);

    if (!dependencyId) {
      dependencyId = headVersionDeclarations.find(
        (d) => d.declaration?.uri === dependencyUri,
      )?.declaration?.id;
    }

    if (dependencyId) {
      await tx
        .insert(dependencies)
        .values({
          dependentId,
          dependencyId,
        })
        .onConflictDoNothing();
    } else {
      logger.warn(
        `Could not resolve dependency: ${dependencyUri} for ${dependentUri}`,
      );
    }
  }
}

/**
 * Updates an existing declaration with new code metadata from extracted source code.
 *
 * This operation occurs when:
 * - A declaration with the same URI already exists in the database
 * - The source code has been modified or re-extracted
 *
 * The function:
 * 1. Merges the new code metadata into the existing declaration's metadata
 * 2. Updates the progress to "enriching" to trigger enrichment processing
 * 3. Preserves other metadata fields (e.g., specs) that may exist
 *
 * @param tx - Database transaction object
 * @param declarationId - ID of the declaration to update
 * @param extractedDeclaration - New code metadata extracted from source
 * @param logger - Logger instance for tracking the update
 * @returns The declaration ID that was updated
 */
async function updateDeclaration(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  declarationId: string,
  extractedDeclaration: DeclarationCodeMetadata,
): Promise<string> {
  const logger = Logger.get({
    declarationId,
  });

  logger.info(
    `✅ Updating existing declaration ${declarationId} (matched by URI)`,
  );

  await tx
    .update(declarations)
    .set({
      metadata: mergeJson(declarations.metadata, {
        codeMetadata: extractedDeclaration,
      }),
      progress: "enriching",
    })
    .where(eq(declarations.id, declarationId))
    .returning();

  return declarationId;
}

/**
 * Links a task-created declaration to its actual code implementation.
 *
 * This operation is critical for connecting AI-generated specifications to real code.
 *
 * Scenario:
 * 1. AI task creates a declaration with specs (e.g., "Create a UserProfile page")
 * 2. Task declaration has no URI yet (it's just a spec/plan)
 * 3. Code is generated or written, creating the actual implementation
 * 4. This function links the task declaration to the code by:
 *    - Setting the URI to point to the actual code location
 *    - Adding the extracted code metadata
 *    - Preserving the original specs metadata
 *
 * The result is a declaration that has both:
 * - High-level specs from the task (what it should do)
 * - Detailed code metadata (what it actually does)
 *
 * @param tx - Database transaction object
 * @param declarationId - ID of the task declaration to link
 * @param extractedDeclaration - Code metadata extracted from the implementation
 * @param logger - Logger instance for tracking the linking operation
 * @returns The declaration ID that was linked
 */
async function linkDeclaration(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  declarationId: string,
  extractedDeclaration: DeclarationCodeMetadata,
  logger: ReturnType<typeof Logger.get>,
): Promise<string> {
  logger.info(
    `✅ LINKING task declaration ${declarationId} to code declaration ${extractedDeclaration.uri}`,
  );

  await tx
    .update(declarations)
    .set({
      uri: extractedDeclaration.uri,
      metadata: mergeJson(declarations.metadata, {
        codeMetadata: extractedDeclaration,
      }),
    })
    .where(eq(declarations.id, declarationId));

  return declarationId;
}

/**
 * Creates a brand new declaration for code that wasn't previously tracked.
 *
 * This operation occurs when:
 * - Code is found that doesn't match any existing declarations by URI
 * - No task declarations can be linked to this code
 * - Typically happens for:
 *   - Utility functions and helpers
 *   - Supporting types and interfaces
 *   - Class methods and properties
 *   - Code added outside the task system
 *
 * The created declaration includes:
 * - A unique ID (nanoid)
 * - URI pointing to the code location
 * - Code metadata extracted from source
 * - Progress set to "enriching" for AI enrichment
 * - Association with project and user
 *
 * @param tx - Database transaction object
 * @param extractedDeclaration - Code metadata extracted from source
 * @param filePath - File path where the declaration exists
 * @param projectId - ID of the project this declaration belongs to
 * @param userId - ID of the user who owns the project
 * @param logger - Logger instance for tracking creation
 * @returns The ID of the newly created declaration
 */
async function createDeclaration(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  extractedDeclaration: DeclarationCodeMetadata,
  filePath: string,
  projectId: string,
  userId: string,
  logger: ReturnType<typeof Logger.get>,
): Promise<string> {
  const declarationId = nanoid();

  logger.info(
    `Creating NEW declaration ${declarationId} for ${extractedDeclaration.uri} (no match found)`,
  );

  await tx.insert(declarations).values({
    id: declarationId,
    uri: extractedDeclaration.uri,
    path: filePath,
    progress: "enriching",
    metadata: {
      version: "v1",
      codeMetadata: extractedDeclaration,
    },
    projectId,
    userId,
  });

  return declarationId;
}

/**
 * Finds a task declaration that matches the extracted code declaration.
 *
 * This function implements sophisticated matching logic to connect task specifications
 * with actual code implementations. It uses deterministic rules to avoid false matches.
 *
 * **Matching Strategy:**
 *
 * 1. **Filter Eligible Task Declarations:**
 *    - Must have a taskId (created from a task)
 *    - Must not have a URI (not yet linked to code)
 *    - Must not be completed
 *    - Must have specs metadata
 *    - Must be in the same file path
 *
 * 2. **Exclude Ineligible Code Types:**
 *    - Methods, properties, constructors, getters, setters are NOT eligible
 *    - These are typically class members that shouldn't be matched to task declarations
 *
 * 3. **Match Default Exports (Highest Priority):**
 *    - For endpoints and pages (file-based routing)
 *    - Default exports in these files are deterministically the main declaration
 *    - Example: `pages/profile.tsx` default export → ProfilePage task
 *
 * 4. **Match Database Models:**
 *    - Exact name match (case-insensitive)
 *    - Plural/singular variation matching
 *      - "users" spec matches "user" code (plural → singular)
 *      - "user" spec matches "users" code (singular → plural)
 *    - Example: Task spec "User model" → code declaration "users" table
 *
 * **Why These Rules?**
 * - Prevents false positives that could link wrong implementations
 * - Ensures deterministic, repeatable matching
 * - Handles common naming conventions (plural/singular)
 * - Respects framework conventions (file-based routing)
 *
 * @param extractedDeclaration - The declaration extracted from source code
 * @param existingDeclarations - All existing declarations in the version
 * @param filePath - File path where the code was found
 * @param logger - Logger instance for detailed matching logs
 * @returns The matching task declaration if found, null otherwise
 */
function findMatchingTaskDeclaration(
  extractedDeclaration: DeclarationCodeMetadata,
  existingDeclarations: Array<
    NonNullable<
      Awaited<
        ReturnType<typeof getHeadVersionDeclarations>
      >[number]["declaration"]
    >
  >,
  filePath: string,
  logger: ReturnType<typeof Logger.get>,
): NonNullable<
  Awaited<ReturnType<typeof getHeadVersionDeclarations>>[number]["declaration"]
> | null {
  const data = extractedDeclaration;

  logger.info(
    `Checking for high-level declaration match. Existing declarations with no URI: ${existingDeclarations.filter((d) => !d.uri).length}`,
  );

  const taskDeclarations = existingDeclarations.filter(
    (d) =>
      d?.taskId &&
      !d.uri &&
      d.progress !== "completed" &&
      d.metadata?.specs &&
      d.path === filePath,
  );

  logger.info(
    `Found ${taskDeclarations.length} task declarations in file ${filePath}`,
  );

  if (
    data.type === "method" ||
    data.type === "property" ||
    data.type === "constructor" ||
    data.type === "getter" ||
    data.type === "setter"
  ) {
    logger.info(
      `Skipping: data type is ${data.type} (not eligible for linkage)`,
    );
    return null;
  }

  if (data.isDefault) {
    const defaultExportMatch = taskDeclarations.find((d) => {
      const specs = d.metadata?.specs;
      if (!specs || !("type" in specs)) return false;

      if (specs.type === "endpoint" || specs.type === "page") {
        logger.info(
          `✓ Matched default export to ${specs.type} task ${d.id} (deterministic: file-based)`,
        );
        return true;
      }
      return false;
    });

    if (defaultExportMatch) return defaultExportMatch;
  }

  const dbModelMatch = taskDeclarations.find((d) => {
    const specs = d.metadata?.specs;
    if (!specs || !("type" in specs) || specs.type !== "db-model") return false;

    const specName = specs.name.toLowerCase();
    const codeName = data.name.toLowerCase();

    if (codeName === specName) {
      logger.info(
        `✓ Matched db-model by exact name: "${codeName}" === "${specName}" (task ${d.id})`,
      );
      return true;
    }

    const isPlural =
      specName.endsWith("s") && codeName === specName.slice(0, -1);
    const isSingular = !specName.endsWith("s") && codeName === `${specName}s`;

    if (isPlural || isSingular) {
      logger.info(
        `✓ Matched db-model by plural/singular: "${codeName}" ↔ "${specName}" (task ${d.id})`,
      );
      return true;
    }

    return false;
  });

  if (dbModelMatch) return dbModelMatch;

  logger.info(`✗ No deterministic match found for ${data.uri}`);
  return null;
}

/**
 * Main orchestration function that extracts declarations from source code and saves them to the database.
 *
 * This is the entry point for declaration processing and handles the complete workflow:
 *
 * **Process Flow:**
 *
 * 1. **Extract Declarations:**
 *    - Parses source code using TypeScript compiler
 *    - Identifies exportable declarations (functions, classes, types, etc.)
 *    - Extracts metadata (name, type, parameters, dependencies)
 *    - Resolves import paths using project-specific path aliases
 *
 * 2. **Prepare for Transaction:**
 *    - Fetch all head version declarations for the current version
 *    - Identify completed declarations for cleanup
 *
 * 3. **Process Each Declaration (in transaction):**
 *    - Clean up completed declarations from previous runs
 *    - For each extracted declaration:
 *      - Check for existing declaration by URI
 *      - Determine operation (update/link/create)
 *      - Execute the appropriate operation
 *      - Build URI-to-ID mapping for dependency resolution
 *      - Link to current version if not already linked
 *      - Collect enriching jobs for AI processing
 *
 * 4. **Resolve Dependencies:**
 *    - Create dependency relationships between declarations
 *    - Map internal imports to declaration references
 *    - Build dependency graph for impact analysis
 *
 * 5. **Queue Enrichment:**
 *    - Queue AI enrichment jobs for each declaration
 *    - Enrichment adds descriptions, documentation, metadata
 *
 * **Key Features:**
 * - Atomic transaction ensures data consistency
 * - Handles create, update, and link operations intelligently
 * - Cleans up stale data (completed declarations)
 * - Builds comprehensive dependency graph
 * - Queues asynchronous enrichment processing
 *
 * **Error Handling:**
 * - Logs errors with detailed context
 * - Transaction rollback on failure
 * - Continues processing despite individual enrichment failures
 *
 * @param context - Workflow context containing project, branch, version info
 * @param filePath - Relative path to the source file being processed
 * @param sourceCode - Complete source code content of the file
 * @param workspaceDir - Absolute path to the workspace root directory
 */
export async function extractAndSaveDeclarations({
  context,
  filePath,
  sourceCode,
  workspaceDir,
}: {
  context: WorkflowContext;
  filePath: string;
  sourceCode: string;
  workspaceDir: string;
}): Promise<void> {
  const project = context.get("project");
  const branch = context.get("branch");

  const logger = Logger.get({
    projectId: project.id,
    versionId: branch.headVersion.id,
  });

  try {
    const pathAliases = getPathAliases(project.integrationCategories);

    const extracted = await extractDeclarations({
      sourceCode: sourceCode,
      filename: filePath,
      pathAliases,
      workspaceDir,
    });

    logger.info(`Extracted ${extracted.length} declarations.`);

    if (extracted.length > 0) {
      const enrichingJobs: Array<{
        declarationId: string;
        codeMetadata: DeclarationCodeMetadata;
        filePath: string;
        sourceCode: string;
        projectId: string;
      }> = [];

      await db.transaction(async (tx) => {
        const headVersionDeclarations = await getHeadVersionDeclarations(
          tx,
          branch.headVersion.id,
        );

        const allDeclarations = headVersionDeclarations
          .map((d) => d.declaration)
          .filter((d): d is NonNullable<typeof d> => d !== null);

        const completedDeclarations = allDeclarations.filter(
          (d) => d.progress === "completed",
        );

        if (completedDeclarations.length > 0) {
          const idsToDelete = completedDeclarations.map((d) => d.id);
          await tx
            .delete(versionDeclarations)
            .where(
              and(
                inArray(versionDeclarations.declarationId, idsToDelete),
                eq(versionDeclarations.versionId, branch.headVersion.id),
              ),
            );
        }

        const newDeclarationUriToId = new Map<string, string>();

        for (const data of extracted) {
          logger.info(
            `Processing extracted declaration: ${data.uri} (name: ${data.name}, type: ${data.type}, isDefault: ${"isDefault" in data ? data.isDefault : "N/A"})`,
          );

          const [existingDeclarationByUri] = await tx
            .select({ id: declarations.id })
            .from(declarations)
            .where(
              and(
                eq(declarations.projectId, project.id),
                eq(declarations.uri, data.uri),
              ),
            )
            .limit(1);

          const decision = determineDeclarationOperation(
            data,
            allDeclarations,
            existingDeclarationByUri,
            filePath,
            logger,
          );

          let declarationId: string;

          switch (decision.type) {
            case "update": {
              declarationId = await updateDeclaration(
                tx,
                decision.declarationId,
                data,
              );
              break;
            }

            case "link": {
              declarationId = await linkDeclaration(
                tx,
                decision.declarationId,
                data,
                logger,
              );
              break;
            }

            case "create": {
              declarationId = await createDeclaration(
                tx,
                data,
                filePath,
                project.id,
                project.userId,
                logger,
              );
              break;
            }
          }

          newDeclarationUriToId.set(data.uri, declarationId);

          enrichingJobs.push({
            declarationId,
            codeMetadata: data,
            filePath,
            sourceCode,
            projectId: project.id,
          });

          const existingVersionLink = headVersionDeclarations.find(
            (vd) => vd.declarationId === declarationId,
          );

          if (!existingVersionLink) {
            await tx.insert(versionDeclarations).values({
              versionId: branch.headVersion.id,
              declarationId,
            });
          }
        }

        await resolveDependencies(
          tx,
          extracted,
          newDeclarationUriToId,
          headVersionDeclarations,
          logger,
        );
      });

      logger.info(
        `Successfully inserted ${extracted.length} declarations and linked to version.`,
      );

      for (const job of enrichingJobs) {
        await queueEnrichingJob(job);
      }
    }
  } catch (error) {
    logger.error("Failed to extract or save declarations", {
      extra: {
        error:
          error instanceof Error
            ? { message: error.message, stack: error.stack }
            : error,
      },
    });
  }
}
