import Link from "next/link";
import { useParams } from "next/navigation";

import { buttonVariants } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import type { RouterOutputs } from "@integramind/api";
import type { EndpointFlowMetadata, FlowType } from "@integramind/shared/types";
import { CreateFlowDialog } from "./create-flow-dialog";

export function FlowList({
  flows,
  type,
}: {
  flows: RouterOutputs["flows"]["list"];
  type: FlowType;
}) {
  const { flowId: currentFlowId } = useParams<{ flowId: string }>();

  return (
    <div className="flex flex-col size-full gap-2">
      <CreateFlowDialog type={type} />
      <ScrollArea className="h-[calc(100dvh-120px)] w-full">
        <div className="flex flex-col gap-1">
          {flows?.map((flow) => (
            <Link
              href={`/workspaces/${flow.workspaceId}/${flow.id}`}
              key={flow.id}
              className={cn(buttonVariants({ variant: "ghost" }), {
                "bg-accent": currentFlowId === flow.id,
                "justify-between items-center": flow.type === "endpoint",
              })}
            >
              {flow.name}
              {flow.type === "endpoint" && (
                <span
                  className={cn({
                    "text-primary":
                      (flow.metadata as EndpointFlowMetadata).method === "get",
                    "text-success":
                      (flow.metadata as EndpointFlowMetadata).method === "post",
                    "text-warning":
                      (flow.metadata as EndpointFlowMetadata).method ===
                      "patch",
                    "text-destructive":
                      (flow.metadata as EndpointFlowMetadata).method ===
                      "delete",
                  })}
                >
                  {(flow.metadata as EndpointFlowMetadata).method.toUpperCase()}
                </span>
              )}
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
