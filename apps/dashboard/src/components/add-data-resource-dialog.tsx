"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@integramind/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@integramind/ui/dialog";
import { ScrollArea } from "@integramind/ui/scroll-area";

import type { DataResourceProvider } from "~/types";
import { AddDataResourceForm } from "~/components/add-data-resource-form";
import { PostgreSQLIcon } from "./icons/postgresql-icon";

export function AddDataResourceDialog() {
  const [provider, setProvider] = useState<DataResourceProvider | undefined>();
  const [addResourceDialogOpen, setAddResourceDialogOpen] = useState(false);

  return (
    <Dialog
      open={addResourceDialogOpen}
      onOpenChange={setAddResourceDialogOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 size-3.5" />
          Add new data resource
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add new data resource</DialogTitle>
          <DialogDescription>
            {provider
              ? `Enter your ${provider} details then press add.`
              : "Select a resource provider to add."}
          </DialogDescription>
        </DialogHeader>
        {provider ? (
          <AddDataResourceForm
            provider={provider}
            setAddResourceDialogOpen={setAddResourceDialogOpen}
          />
        ) : (
          <ScrollArea className="h-[300px] w-full">
            <div className="grid size-full grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={() => setProvider("postgres")}
                className="flex h-24 w-full flex-col items-center justify-center gap-2"
              >
                <PostgreSQLIcon className="size-6" />
                Postgres
              </Button>
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
