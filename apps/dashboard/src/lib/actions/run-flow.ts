"use server";

import { api } from "../trpc/rsc";

export async function runFlow(flowId: string) {
  try {
    const { stopPrimitive, functionPrimitives, edges } =
      await api.flows.getPrimitivesAndEdges({
        id: flowId,
      });
    console.log(edges);
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: "Failed to compile flow",
    };
  }
}
