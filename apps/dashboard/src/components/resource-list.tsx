import { Button } from "@specly/ui/button";
import { ScrollArea } from "@specly/ui/scroll-area";

import type { BaseIntegration, Resource } from "@specly/shared/types";
import { AddResourceDialog } from "./add-resource-dialog";

export function ResourceList({
  integrations,
  resources,
}: {
  integrations: BaseIntegration[];
  resources: Resource[];
}) {
  return (
    <div className="flex size-full flex-col gap-2">
      <AddResourceDialog integrations={integrations} />
      <ScrollArea className="h-[calc(100dvh-120px)] w-full">
        <div className="flex flex-col">
          {resources?.map((resource) => (
            <Button key={resource.id} variant="ghost" size="sm">
              {resource.name}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
