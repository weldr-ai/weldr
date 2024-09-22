"use server";

import {
  REQUIREMENTS_AGENT_PROMPT,
  requirementsGatheringAgent,
} from "@specly/ai";
import type { CoreMessage } from "ai";

export async function generateFunction(messages: CoreMessage[]) {
  const stream = await requirementsGatheringAgent({
    system: REQUIREMENTS_AGENT_PROMPT,
    messages,
  });

  return stream;
}

// const functionPrimitive = await db.query.primitives.findFirst({
//   where: and(
//     eq(primitives.id, functionId),
//     eq(primitives.createdBy, session.user.id),
//   ),
// });

// if (!functionPrimitive) {
//   throw new Error("Function not found");
// }

// if (
//   !functionPrimitive.name ||
//   !functionPrimitive.description ||
//   !functionPrimitive.metadata
// ) {
//   throw new Error("Function not properly configured");
// }

// const functionMetadata = functionPrimitive.metadata as FunctionMetadata;

// const resourcesInfo: {
//   name: string;
//   provider: "postgres" | "mysql";
//   auth: unknown;
// }[] = [];

// for (const resource of functionMetadata.resources ?? []) {
//   const resourceInfo = await db.query.resources.findFirst({
//     where: eq(resources.id, resource.id),
//   });

//   if (!resourceInfo) {
//     continue;
//   }

//   resourcesInfo.push({
//     name: resourceInfo.name,
//     provider: resourceInfo.provider,
//     auth: resourceInfo.metadata,
//   });
// }

// const chain = new DevelopmentChain();
