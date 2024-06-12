import { useQuery } from "@tanstack/react-query";
import { Loader2Icon } from "lucide-react";

import { Button } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";

import { getDataResources } from "~/lib/queries/data-resources";
import { AddDataResourceDialog } from "./add-data-resource-dialog";

export function DataResourceList({ workspaceId }: { workspaceId: string }) {
  const {
    isLoading,
    isRefetching,
    data: dataResources,
  } = useQuery({
    queryKey: ["data-resources"],
    queryFn: () => getDataResources({ workspaceId }),
    refetchInterval: 1000 * 60 * 5,
  });

  return (
    <div className="flex size-full flex-col gap-2">
      <AddDataResourceDialog />
      {!isLoading && !isRefetching ? (
        <ScrollArea className="h-[calc(100dvh-148px)] w-full">
          <div className="flex flex-col">
            {dataResources?.map((dataResource) => (
              <Button key={dataResource.id} variant="ghost" size="sm">
                {dataResource.name}
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
