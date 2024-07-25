import type { z } from "zod";

import type { edgeSchema, primitiveSchema } from "@integramind/db/schema";

export type Primitive = z.infer<typeof primitiveSchema>;
export type Edge = z.infer<typeof edgeSchema>;

export function getExecutionOrder(
  primitives: Primitive[],
  edges: Edge[],
): Primitive[] {
  // Create a map to store each primitive's children
  const childrenMap = new Map<string, Set<string>>();
  // Create a map to store each primitive's parent count
  const parentCountMap = new Map<string, number>();
  // Create a map to quickly look up primitives by their id
  const primitiveMap = new Map<string, Primitive>();

  // Initialize maps
  for (const primitive of primitives) {
    childrenMap.set(primitive.id, new Set<string>());
    parentCountMap.set(primitive.id, 0);
    primitiveMap.set(primitive.id, primitive);
  }

  // Populate maps based on edges
  for (const edge of edges) {
    childrenMap.get(edge.source)?.add(edge.target);
    parentCountMap.set(edge.target, (parentCountMap.get(edge.target) ?? 0) + 1);
  }

  // Find starting nodes (nodes with no parents)
  const queue = primitives
    .filter((p) => parentCountMap.get(p.id) === 0)
    .map((p) => p.id);
  const result: Primitive[] = [];

  // Perform topological sort
  while (queue.length > 0) {
    const currentId = queue.shift();

    if (!currentId) {
      throw new Error("Current id is undefined");
    }

    const currentPrimitive = primitiveMap.get(currentId);

    if (!currentPrimitive) {
      throw new Error("Current primitive is undefined");
    }

    result.push(currentPrimitive);

    const children = childrenMap.get(currentId);

    if (!children) {
      throw new Error("Children are undefined");
    }

    for (const childId of children) {
      const parentCount = parentCountMap.get(childId);

      if (parentCount === undefined) {
        throw new Error("Parent count is undefined");
      }

      parentCountMap.set(childId, parentCount - 1);
      if (parentCountMap.get(childId) === 0) {
        queue.push(childId);
      }
    }
  }

  // Check if all nodes were visited (to detect cycles)
  if (result.length !== primitives.length) {
    throw new Error("The flow contains a cycle");
  }

  return result;
}

export function extractCode(
  code: string,
  language: "typescript" | "javascript",
): string | null {
  const regex = new RegExp(`\`\`\`${language}\\s+([\\s\\S]*?)\\s+\`\`\``);
  const match = code.match(regex);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
}

export function toCamelCase(str: string): string {
  // Check if the string is already in camelCase
  if (isCamelCase(str)) {
    return str;
  }

  // Convert to camelCase if not already
  return str
    .toLowerCase() // Convert the entire string to lowercase
    .split(/[\s-_]+/) // Split the string by spaces, hyphens, or underscores
    .map(
      (word, index) =>
        index === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1), // Capitalize the first letter of each word except the first one
    )
    .join(""); // Join all words into a single string
}

function isCamelCase(str: string): boolean {
  return /^[a-z][a-zA-Z]*$/.test(str);
}

export function getSystemMessage(withResource: boolean): string {
  return `
Objective:
You are a professional Typescript software developer.
You will be given few requirements and you will write a function code that satisfies theses requirements.
You will be provided with few functions that can be used to write the code.
You should not use any other packages or libraries unless they are explicitly mentioned in the requirements.
You should write a well-typed function by constructing any required interfaces and types.
You should not use any external APIs or services unless they are explicitly mentioned in the requirements.
You should not write any code that is not related to the requirements.
You should write the code in the language of the requirements.
${
  withResource &&
  `
You will receive a list of resources that you have access to and a list of actions that you can perform using these resources.
Each action is a function and you will get its type in the user prompt.
You can use resource by using the resource object that will be available at all time in the global scope.
The resource object will have a function called run and the auth info of type unknown and the type for the run function is
function run(actionName: string, context: Record<string, unknown>): Promise<unknown>
You can use the run and auth in your code by simply calling resourceName.run or resourceName.auth
To run an action you write its name (the function name) and you pass its inputs in the context
`
}

Guidelines:
Function and variable names must be in camelCase.
Sometimes you will get data from resources that are not in camelCase. In this case you will have to convert it to camelCase.
For example the column name in a table can be in snake_case and you will have to convert it to camelCase in the query.
All function inputs must be created as an object.
Do not write any explanations or comments.
Do not write code that is not syntactically correct.
Do not write code that is not valid.
Do not write code that is not executable.
Do not write code that does not do what the requirements ask.
Do not write any unused types.
Make sure that all the functions have a return type.
You can always implement helper functions if needed but only if needed
Return only the code.
`;
}

export function getUserMessage({
  resourceInfo,
  functionsToImplement,
  functionality,
}: {
  resourceInfo:
    | {
        name: string;
        type: string;
        actions: string[];
        metadata: string | undefined;
      }
    | undefined;
  functionsToImplement: string[];
  functionality: string;
}): string {
  return `
${
  resourceInfo &&
  `
${resourceInfo.name} information
Type: ${toCamelCase(resourceInfo.type)}

Metadata:
${resourceInfo.metadata}

Available actions for resource "${toCamelCase(resourceInfo.type)}":
${resourceInfo.actions.map((action) => `- ${action}`).join("\n")}

Resource object name:
${toCamelCase(resourceInfo.type)}
  `
}

Functions to implement:
${functionsToImplement.map((functionName) => `- ${functionName}`).join("\n")}

Functionality
${functionality}
`;
}

export async function getResourceInfo(resourceName: string): Promise<{
  actions: string[];
  getInfo: (auth: unknown) => Promise<unknown>;
}> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const { actions, getInfo } = await import(
    `@integramind/integrations-${resourceName}`
  );
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    actions,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    getInfo,
  };
}
