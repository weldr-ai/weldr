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
  primitives.forEach((primitive) => {
    childrenMap.set(primitive.id, new Set<string>());
    parentCountMap.set(primitive.id, 0);
    primitiveMap.set(primitive.id, primitive);
  });

  // Populate maps based on edges
  edges.forEach((edge) => {
    childrenMap.get(edge.source)?.add(edge.target);
    parentCountMap.set(edge.target, (parentCountMap.get(edge.target) ?? 0) + 1);
  });

  // Find starting nodes (nodes with no parents)
  const queue = primitives
    .filter((p) => parentCountMap.get(p.id) === 0)
    .map((p) => p.id);
  const result: Primitive[] = [];

  // Perform topological sort
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const currentPrimitive = primitiveMap.get(currentId)!;
    result.push(currentPrimitive);

    childrenMap.get(currentId)?.forEach((childId) => {
      parentCountMap.set(childId, parentCountMap.get(childId)! - 1);
      if (parentCountMap.get(childId) === 0) {
        queue.push(childId);
      }
    });
  }

  // Check if all nodes were visited (to detect cycles)
  if (result.length !== primitives.length) {
    throw new Error("The flow contains a cycle");
  }

  return result;
}

export function checkMethod(
  reqMethod: "GET" | "POST" | "PUT" | "DELETE",
  actionType: "create" | "read" | "update" | "delete",
) {
  const actionTypeToMethod: Record<string, string> = {
    create: "POST",
    read: "GET",
    update: "PUT",
    delete: "DELETE",
  };
  return actionTypeToMethod[actionType] === reqMethod;
}
