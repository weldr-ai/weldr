import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { buttonVariants } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import { CreateCompoundBlockDialog } from "~/components/create-compound-block-dialog";
import { getCompoundBlocks } from "~/lib/actions/compound-blocks";

export function CompoundBlocksPrimarySidebar({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { compoundBlockId: currentCompoundBlockId } = useParams<{
    compoundBlockId: string;
  }>();
  const {
    isLoading,
    isRefetching,
    data: compoundBlocks,
  } = useQuery({
    queryKey: ["compound-blocks"],
    queryFn: () => getCompoundBlocks({ workspaceId }),
    refetchInterval: 1000 * 60 * 5,
  });

  return (
    <div className="flex size-full min-h-[calc(100dvh-128px)] flex-col gap-2 overflow-y-auto">
      <CreateCompoundBlockDialog />
      {!isLoading && !isRefetching ? (
        <ScrollArea className="h-[calc(100dvh-152px)] w-full">
          <div className="flex flex-col gap-1">
            {compoundBlocks?.map((compoundBlock) => (
              <Link
                href={`/workspaces/${workspaceId}/compound-blocks/${compoundBlock.id}`}
                key={compoundBlock.id}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  {
                    "bg-accent": currentCompoundBlockId === compoundBlock.id,
                  },
                )}
              >
                {compoundBlock.name}
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
