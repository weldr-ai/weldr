"use client";

import { EditIcon } from "lucide-react";
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
import type { Integration } from "@weldr/shared/types";
import { PostgresIcon } from "@weldr/ui/icons/postgres-icon";

export function AddResourceDialog({
  integration,
  resource,
  className,
}: {
  integration: Pick<Integration, "id" | "name" | "type">;
  resource?: RouterOutputs["projects"]["byId"]["resources"][number];
  className?: string;
}) {
  const [addResourceDialogOpen, setAddResourceDialogOpen] = useState(false);

  return (
    <Dialog
      open={addResourceDialogOpen}
      onOpenChange={setAddResourceDialogOpen}
    >
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={resource ? "outline" : "default"}
          className={className}
        >
          {resource ? (
            <>
              {resource.name}
              <EditIcon className="ml-auto size-3.5" />
            </>
          ) : (
            <>
              {integration.type === "postgres" && (
                <PostgresIcon className="mr-2 size-4" />
              )}
              Setup {integration.name}
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
          setAddResourceDialogOpen={setAddResourceDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
