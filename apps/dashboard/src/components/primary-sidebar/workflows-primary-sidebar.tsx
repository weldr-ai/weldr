import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { buttonVariants } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import { CreateWorkflowDialog } from "~/components/create-workflow-dialog";
import { getWorkflows } from "~/lib/actions/workflows";

export function WorkflowsPrimarySidebar({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { workflowId: currentWorkflowId } = useParams<{ workflowId: string }>();
  const {
    isLoading,
    isRefetching,
    data: workflows,
  } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => getWorkflows({ workspaceId }),
    refetchInterval: 1000 * 60 * 5,
  });

  return (
    <div className="flex size-full min-h-[calc(100dvh-128px)] flex-col gap-2 overflow-y-auto">
      <CreateWorkflowDialog />
      {!isLoading && !isRefetching ? (
        <ScrollArea className="h-[calc(100dvh-152px)] w-full">
          <div className="flex flex-col gap-1">
            {workflows?.map((workflow) => (
              <Link
                href={`/workspaces/${workspaceId}/workflows/${workflow.id}`}
                key={workflow.id}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  {
                    "bg-accent": currentWorkflowId === workflow.id,
                  },
                )}
              >
                {workflow.name}
              </Link>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex h-[calc(100dvh-152px)] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
