import { cn } from "@integramind/ui/utils";
import { TRPCError } from "@trpc/server";
import { notFound, redirect } from "next/navigation";

import { FlowBuilder } from "~/components/flow-builder";
import { api } from "~/lib/trpc/server";
import type { FlowNode, FlowNodeData } from "~/types";
import { Overlay } from "./_components/overlay";

export default async function FlowPage({
  params,
}: {
  params: Promise<{ flowId: string }>;
}): Promise<JSX.Element | undefined> {
  try {
    const { flowId } = await params;
    const flow = await api.flows.byIdWithAssociatedData({
      id: flowId,
    });

    const initialEdges = await api.edges.listByFlowId({
      flowId,
    });

    const initialNodes: FlowNode[] = flow.primitives.map((primitive) => ({
      id: primitive.id,
      type: "primitive",
      dragHandle: ".drag-handle",
      position: { x: primitive.positionX, y: primitive.positionY },
      data: primitive as FlowNodeData,
    }));

    return (
      <div
        className={cn("flex size-full", {
          relative: !flow.inputSchema,
        })}
      >
        <FlowBuilder
          flow={flow}
          initialNodes={initialNodes}
          initialEdges={initialEdges}
        />
        <Overlay show={!flow.inputSchema} flowType={flow.type} />
      </div>
    );
  } catch (error) {
    console.error(error);
    if (error instanceof TRPCError) {
      switch (error.code) {
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: notFound function already returns
        case "NOT_FOUND":
          notFound();
        case "UNAUTHORIZED":
        // biome-ignore lint/suspicious/noFallthroughSwitchClause: redirect function already returns
        case "FORBIDDEN":
          redirect("/auth/sign-in");
        default:
          return <div>Error</div>;
      }
    }
    return <div>Error</div>;
  }
}
