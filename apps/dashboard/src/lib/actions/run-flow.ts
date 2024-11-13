"use server";

import type { EndpointFlow } from "@integramind/shared/types";
import { generateCode } from "../ai/helpers";
import {
  FLOW_COMPOSER_AGENT_PROMPT,
  getFlowComposerAgentPrompt,
} from "../ai/prompts";
import { api } from "../trpc/rsc";

export async function runFlow(flowId: string) {
  try {
    const result = await api.flows.getPrimitivesAndEdges({
      id: flowId,
    });

    if (result.type !== "endpoint") {
      throw new Error("Flow is not an endpoint");
    }

    const prompt = getFlowComposerAgentPrompt({
      flow: {
        id: result.id,
        path: (result.metadata as EndpointFlow["metadata"]).path,
        method: (result.metadata as EndpointFlow["metadata"]).method,
        inputSchema: result.inputSchema,
        outputSchema: result.outputSchema,
      },
      functions: result.functionPrimitives,
      edges: result.edges.map((edge) => ({
        source: edge.source,
        target: edge.target,
      })),
    });

    const code = await generateCode({
      functionId: result.id,
      prompt,
      systemPrompt: FLOW_COMPOSER_AGENT_PROMPT,
    });

    console.log(code);

    await api.flows.update({
      where: { id: flowId },
      payload: {
        type: "endpoint",
        code,
      },
    });
  } catch (error) {
    console.error(error);
    return {
      status: "error",
      message: "Failed to compile flow",
    };
  }
}
