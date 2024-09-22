import { Loader2Icon } from "lucide-react";

import { Button } from "@specly/ui/button";
import { ScrollArea } from "@specly/ui/scroll-area";

import { api } from "~/lib/trpc/react";
import { AddResourceDialog } from "./add-resource-dialog";

export function ResourceList({ workspaceId }: { workspaceId: string }) {
  const {
    data: resources,
    isLoading,
    isRefetching,
  } = api.resources.getAll.useQuery({
    workspaceId,
  });

  return (
    <div className="flex size-full flex-col gap-2">
      <AddResourceDialog />
      {!isLoading && !isRefetching ? (
        <ScrollArea className="h-[calc(100dvh-116px)] w-full">
          <div className="flex flex-col">
            {resources?.map((resource) => (
              <Button key={resource.id} variant="ghost" size="sm">
                {resource.name}
              </Button>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex h-[calc(100dvh-116px)] items-center justify-center">
          <Loader2Icon className="size-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}
