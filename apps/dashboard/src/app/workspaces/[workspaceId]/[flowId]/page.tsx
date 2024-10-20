import type { Conversation, Flow } from "@specly/shared/types";
import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { FlowBuilder } from "~/components/flow-builder";
import { api } from "~/lib/trpc/rsc";
import type { FlowEdge, FlowNode, FlowNodeData } from "~/types";

export default async function FlowPage({
  params,
}: {
  params: { flowId: string };
}): Promise<JSX.Element | undefined> {
  try {
    const flow = await api.flows.getByIdWithAssociatedData({
      id: params.flowId,
    });

    const initialNodes: FlowNode[] = flow.primitives
      .sort((a, b) =>
        a.type === "iterator" ? -1 : b.type === "iterator" ? 1 : 0,
      )
      .map((primitive) => ({
        id: primitive.id,
        type: primitive.type,
        dragHandle: ".drag-handle",
        deletable: primitive.type !== "response",
        position: { x: primitive.positionX, y: primitive.positionY },
        parentId: primitive.parentId ?? undefined,
        extent: primitive.parentId ? "parent" : undefined,
        data: {
          id: primitive.id,
          name: primitive.name,
          description: primitive.description,
          type: primitive.type,
          metadata: primitive.metadata,
          createdAt: primitive.createdAt,
          updatedAt: primitive.updatedAt,
          createdBy: primitive.createdBy,
          flowId: primitive.flowId,
          conversation: primitive.conversation as Conversation,
          flow: {
            inputSchema: flow.inputSchema,
          },
        } as FlowNodeData,
      }));

    const initialEdges: FlowEdge[] = flow.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      sourceHandle: edge.sourceHandle,
      target: edge.target,
      targetHandle: edge.targetHandle,
      type: "deletable-edge",
    }));

    return (
      <div className="flex size-full">
        <FlowBuilder
          flow={flow as Flow}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof TRPCError) {
      switch (error.code) {
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: notFound function already returns
        case "NOT_FOUND":
          notFound();
        case "UNAUTHORIZED":
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: redirect function already returns
        case "FORBIDDEN":
          redirect("/");
        default:
          console.error(error);
      }
    }
  }
}
