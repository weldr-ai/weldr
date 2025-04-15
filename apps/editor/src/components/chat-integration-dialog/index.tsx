"use client";

import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/dialog";
import { PostgresIcon } from "@weldr/ui/icons";
import { cn } from "@weldr/ui/utils";
import { useState } from "react";
import { PostgresForm } from "./postgres-form";

interface ChatIntegrationDialogProps {
  integrationTemplate: RouterOutputs["integrationTemplates"]["byId"];
  status: "pending" | "success" | "error" | "cancelled";
  onSuccess?: () => void;
  onCancel?: () => void;
  className?: string;
}

export function ChatIntegrationDialog({
  integrationTemplate,
  status,
  onSuccess,
  onCancel,
  className,
}: ChatIntegrationDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const renderForm = () => {
    switch (integrationTemplate.type) {
      case "postgres": {
        return (
          <PostgresForm
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

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="outline"
          className={cn(
            "group gap-2 bg-background px-1 hover:bg-accent",
            className,
          )}
          disabled={status !== "pending"}
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
                status === "pending" && "animate-pulse bg-warning",
                status === "success" && "bg-success",
                status === "error" && "bg-destructive",
                status === "cancelled" && "bg-muted-foreground",
              )}
            />
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup {integrationTemplate.name}</DialogTitle>
          <DialogDescription>
            Add your database connection details to continue
          </DialogDescription>
        </DialogHeader>
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
}
