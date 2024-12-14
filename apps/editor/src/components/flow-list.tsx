import Link from "next/link";
import { useParams } from "next/navigation";

import { buttonVariants } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import type { RouterOutputs } from "@integramind/api";
import { CreateFlowDialog } from "./create-flow-dialog";

export function FlowList({
  flows,
}: {
  flows: RouterOutputs["flows"]["list"];
}) {
  const { flowId: currentFlowId } = useParams<{ flowId: string }>();

  return (
    <div className="flex flex-col size-full gap-2">
      <CreateFlowDialog />
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
