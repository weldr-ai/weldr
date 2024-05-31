import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { buttonVariants } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import { CreateAccessPointDialog } from "~/components/create-access-point-dialog";
import { getAccessPoints } from "~/lib/actions/access-points";

export function AccessPointsPrimarySidebar({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { accessPointId: currentAccessPointId } = useParams<{
    accessPointId: string;
  }>();
  const {
    isLoading,
    isRefetching,
    data: accessPoints,
  } = useQuery({
    queryKey: ["access-points"],
    queryFn: () => getAccessPoints({ workspaceId }),
    refetchInterval: 1000 * 60 * 5,
  });

  return (
    <div className="flex size-full min-h-[calc(100dvh-128px)] flex-col gap-2 overflow-y-auto">
      <CreateAccessPointDialog />
      {!isLoading && !isRefetching ? (
        <ScrollArea className="h-[calc(100dvh-152px)] w-full">
          <div className="flex flex-col gap-1">
            {accessPoints?.map((accessPoint) => (
              <Link
                href={`/workspaces/${workspaceId}/access-points/${accessPoint.id}`}
                key={accessPoint.id}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  {
                    "bg-accent": currentAccessPointId === accessPoint.id,
                  },
                )}
              >
                {accessPoint.name}
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
