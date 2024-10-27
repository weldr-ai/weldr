import Link from "next/link";
import { useParams } from "next/navigation";

import { buttonVariants } from "@specly/ui/button";
import { ScrollArea } from "@specly/ui/scroll-area";
import { cn } from "@specly/ui/utils";

import type { BaseFlow, FlowType } from "@specly/shared/types";
import { CreateFlowDialog } from "./create-flow-dialog";

export function FlowList({
  flows,
  type,
}: { flows: BaseFlow[]; type: FlowType }) {
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
              })}
            >
              {flow.name}
            </Link>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
