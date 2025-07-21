"use client";

import { useState } from "react";

import type { RouterOutputs } from "@weldr/api";
import type { IntegrationStatus } from "@weldr/shared/types";
import { Button } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/components/dialog";
import { PostgresIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import { PostgresForm } from "./postgres-form";

interface ChatIntegrationDialogProps {
  integrationTemplate: RouterOutputs["integrationTemplates"]["byId"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  status: IntegrationStatus;
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function ChatIntegrationDialog({
  integrationTemplate,
  environmentVariables,
  status,
  onSuccess,
  onCancel,
  className,
}: ChatIntegrationDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const renderForm = () => {
    switch (integrationTemplate.key) {
      case "postgresql": {
        return (
          <PostgresForm
            environmentVariables={environmentVariables}
            integrationTemplate={integrationTemplate}
            onSuccess={onSuccess}
            onCancel={onCancel}
            onClose={() => setDialogOpen(false)}
          />
        );
      }
      default: {
        return null;
      }
    }
  };

  const getDescription = () => {
    switch (integrationTemplate.key) {
      case "postgresql": {
        return "Add your database connection details to continue";
      }
    }
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "group w-full justify-between gap-2 bg-background px-1 hover:bg-accent",
            className,
          )}
          disabled={status !== "requires_configuration"}
        >
          <div className="flex items-center gap-2">
            <PostgresIcon className="size-4" />
            Setup {integrationTemplate.name}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 rounded-sm border bg-background px-1.5 py-0.5 group-hover:bg-accent",
              "font-medium text-[0.65rem] text-muted-foreground",
            )}
          >
            <div
              className={cn(
                "size-1.5 rounded-full",
                status === "requires_configuration" && "bg-warning",
                status === "completed" && "bg-success",
                status === "failed" && "bg-destructive",
                status === "cancelled" && "bg-muted-foreground",
              )}
            />
            {status
              .replaceAll("_", " ")
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup {integrationTemplate.name}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
}
