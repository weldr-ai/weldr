import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { buttonVariants } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import { CreateComponentDialog } from "~/components/create-component-dialog";
import { getComponents } from "~/lib/actions/components";

export function ComponentsPrimarySidebar({
  workspaceId,
}: {
  workspaceId: string;
}) {
  const { componentId: currentComponentId } = useParams<{
    componentId: string;
  }>();
  const {
    isLoading,
    isRefetching,
    data: components,
  } = useQuery({
    queryKey: ["components"],
    queryFn: () => getComponents({ workspaceId }),
    refetchInterval: 1000 * 60 * 5,
  });

  return (
    <div className="flex size-full min-h-[calc(100dvh-128px)] flex-col gap-2 overflow-y-auto">
      <CreateComponentDialog />
      {!isLoading && !isRefetching ? (
        <ScrollArea className="h-[calc(100dvh-152px)] w-full">
          <div className="flex flex-col gap-1">
            {components?.map((component) => (
              <Link
                href={`/workspaces/${workspaceId}/components/${component.id}`}
                key={component.id}
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  {
                    "bg-accent": currentComponentId === component.id,
                  },
                )}
              >
                {component.name}
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
