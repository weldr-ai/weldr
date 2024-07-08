import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";

import { Button } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";

import { getResources } from "~/lib/queries/resources";
import { AddResourceDialog } from "./add-resource-dialog";

export function ResourceList({ workspaceId }: { workspaceId: string }) {
  // FIXME: use suspense with revalidateTag
  const {
    isLoading,
    isRefetching,
    data: resources,
  } = useQuery({
    queryKey: ["resources"],
    queryFn: () => getResources({ workspaceId }),
  });

  return (
    <div className="flex size-full flex-col gap-2">
      <AddResourceDialog />
      {!isLoading && !isRefetching ? (
        <ScrollArea className="h-[calc(100dvh-148px)] w-full">
          <div className="flex flex-col">
            {resources?.map((resource) => (
              <Button key={resource.id} variant="ghost" size="sm">
                {resource.name}
              </Button>
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
