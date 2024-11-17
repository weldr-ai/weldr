import { Button } from "@integramind/ui/button";
import { ScrollArea } from "@integramind/ui/scroll-area";

import type { RouterOutputs } from "@integramind/api";
import type { Integration } from "@integramind/shared/types";
import { PostgresIcon } from "@integramind/ui/icons/postgres-icon";
import { DatabaseIcon } from "lucide-react";
import { AddResourceDialog } from "./add-resource-dialog";

export function ResourceList({
  integrations,
  resources,
}: {
  integrations: Omit<Integration, "dependencies">[];
  resources: RouterOutputs["resources"]["list"];
}) {
  return (
    <div className="flex size-full flex-col gap-2">
      <AddResourceDialog integrations={integrations} />
      <ScrollArea className="h-[calc(100dvh-120px)] w-full">
        <div className="flex flex-col">
          {resources?.map((resource) => (
            <Button key={resource.id} variant="ghost" size="sm">
              {resource.integration.type === "postgres" ? (
                <PostgresIcon className="size-3.5 mr-2" />
              ) : (
                <DatabaseIcon className="size-3.5 mr-2" />
              )}
              {resource.name}
            </Button>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
