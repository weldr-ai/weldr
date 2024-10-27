"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@specly/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@specly/ui/dialog";
import { ScrollArea } from "@specly/ui/scroll-area";

import type { Integration } from "@specly/shared/types";
import { PostgresIcon } from "@specly/ui/icons/postgres-icon";
import { AddResourceForm } from "~/components/add-resource-form";

export function AddResourceDialog({
  integrations,
}: { integrations: Omit<Integration, "dependencies">[] }) {
  const [integrationId, setIntegrationId] = useState<string | undefined>();
  const [addResourceDialogOpen, setAddResourceDialogOpen] = useState(false);

  return (
    <Dialog
      open={addResourceDialogOpen}
      onOpenChange={setAddResourceDialogOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="text-xs">
          <PlusIcon className="mr-1.5 size-3.5" />
          Add new resource
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new resource</DialogTitle>
          <DialogDescription>
            {integrationId
              ? "Enter your resource details then press add."
              : "Select an integration to add a resource."}
          </DialogDescription>
        </DialogHeader>
        {integrationId ? (
          <AddResourceForm
            // biome-ignore lint/style/noNonNullAssertion: <explanation>
            integration={integrations.find((i) => i.id === integrationId)!}
            setAddResourceDialogOpen={setAddResourceDialogOpen}
          />
        ) : (
          <ScrollArea className="h-[300px] w-full">
            <div className="grid size-full grid-cols-3 gap-2">
              {integrations.map((integration) => (
                <Button
                  key={integration.id}
                  variant="outline"
                  onClick={() => setIntegrationId(integration.id)}
                  className="flex h-24 w-full flex-col items-center justify-center gap-2"
                >
                  {integration.type === "postgres" ? (
                    <PostgresIcon className="size-6" />
                  ) : null}
                  {integration.name}
                </Button>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
