"use client";

import { EditIcon, PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@weldr/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/dialog";

import { AddResourceForm } from "@/components/add-resource-form";
import type { RouterOutputs } from "@weldr/api";
import type { EnvironmentVariable, Integration } from "@weldr/shared/types";

export function AddResourceDialog({
  integration,
  env,
  resource,
}: {
  integration: Pick<Integration, "id" | "name" | "type">;
  env: Pick<EnvironmentVariable, "id" | "key">[];
  resource?: RouterOutputs["projects"]["byId"]["resources"][number];
}) {
  const [addResourceDialogOpen, setAddResourceDialogOpen] = useState(false);

  return (
    <Dialog
      open={addResourceDialogOpen}
      onOpenChange={setAddResourceDialogOpen}
    >
      <DialogTrigger asChild>
        <Button variant={resource ? "outline" : "default"} className="text-xs">
          {resource ? (
            <>
              {resource.name}
              <EditIcon className="ml-auto size-3.5" />
            </>
          ) : (
            <>
              <PlusIcon className="mr-1.5 size-3.5" />
              Add new resource
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {integration ? integration.name : "Add new resource"}
          </DialogTitle>
          <DialogDescription>
            {integration
              ? `Enter your ${integration.name} then press add.`
              : "Select an integration to add a resource."}
          </DialogDescription>
        </DialogHeader>
        <AddResourceForm
          integration={integration}
          resource={resource}
          env={env}
          resourceEnvironmentVariables={resource?.environmentVariables}
          setAddResourceDialogOpen={setAddResourceDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
