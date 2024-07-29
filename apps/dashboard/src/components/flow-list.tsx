import { Loader2Icon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

import { buttonVariants } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import type { FlowType } from "@integramind/shared/types";
import { api } from "~/lib/trpc/react";
import { CreateFlowDialog } from "./create-flow-dialog";

export function FlowList({
  workspaceId,
  type,
}: {
  workspaceId: string;
  type: FlowType;
}) {
  const { flowId: currentFlowId } = useParams<{ flowId: string }>();
  const {
    data: flows,
    isLoading,
    isRefetching,
  } = api.flows.getAllByType.useQuery({
    workspaceId,
    type,
  });

  return (
    <div className="flex size-full flex-col gap-2">
      <CreateFlowDialog type={type} />
      {!isLoading && !isRefetching ? (
        <ScrollArea className="h-[calc(100dvh-148px)] w-full">
          <div className="flex flex-col gap-1">
            {flows?.map((flow) => (
              <Link
                href={`/workspaces/${workspaceId}/${type}s/${flow.id}`}
                key={flow.id}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  {
                    "bg-accent": currentFlowId === flow.id,
                  },
                )}
              >
                {flow.name}
              </Link>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex h-[calc(100dvh-152px)] items-center justify-center">
          <Loader2Icon className="size-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
