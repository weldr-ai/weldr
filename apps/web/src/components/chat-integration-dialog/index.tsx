"use client";

import { LoaderIcon } from "lucide-react";
import { useState } from "react";

import type { RouterOutputs } from "@weldr/api";
import type { IntegrationKey, IntegrationStatus } from "@weldr/shared/types";
import { Button } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/components/dialog";
import {
  BetterAuthIcon,
  ORPCIcon,
  PostgresIcon,
  TanstackIcon,
} from "@weldr/ui/icons";
import { cn } from "@weldr/ui/lib/utils";
import { PostgresForm } from "./postgres-form";

interface ChatIntegrationDialogProps {
  onIntegrationMessageChange: ({
    integrationId,
    integrationStatus,
  }: {
    integrationId: string;
    integrationStatus: IntegrationStatus;
  }) => void;
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  integration: {
    id: string;
    key: IntegrationKey;
    status: IntegrationStatus;
  };
  className?: string;
}

export function ChatIntegrationDialog({
  onIntegrationMessageChange,
  environmentVariables,
  className,
  integration,
}: ChatIntegrationDialogProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  const renderForm = () => {
    switch (integration.key) {
      case "postgresql": {
        return (
          <PostgresForm
            integrationId={integration.id}
            environmentVariables={environmentVariables}
            onSuccess={() =>
              onIntegrationMessageChange({
                integrationId: integration.id,
                integrationStatus: "queued",
              })
            }
            onCancel={() =>
              onIntegrationMessageChange({
                integrationId: integration.id,
                integrationStatus: "cancelled",
              })
            }
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
    switch (integration.key) {
      case "postgresql": {
        return "Add your database connection details to continue";
      }
    }
  };

  const getTitle = () => {
    switch (integration.key) {
      case "postgresql": {
        return "PostgreSQL";
      }
      case "better-auth": {
        return "BetterAuth";
      }
      case "tanstack-start": {
        return "Tanstack Start";
      }
      case "orpc": {
        return "oRPC";
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
            "group w-full justify-between gap-2 bg-background pr-1 pl-2 hover:bg-accent disabled:text-muted-foreground disabled:opacity-100",
            className,
          )}
          disabled={integration.status !== "awaiting_config"}
        >
          <div className="flex items-center gap-2">
            {integration.key === "postgresql" && (
              <PostgresIcon className="size-4" />
            )}
            {integration.key === "better-auth" && (
              <BetterAuthIcon className="size-4" />
            )}
            {integration.key === "tanstack-start" && (
              <TanstackIcon className="size-4" />
            )}
            {integration.key === "orpc" && <ORPCIcon className="size-4" />}
            {getTitle()}
          </div>
          <div
            className={cn(
              "flex items-center gap-1 rounded-sm border bg-background px-1.5 py-0.5 group-hover:bg-accent",
              "font-medium text-[0.65rem] text-muted-foreground",
            )}
          >
            {integration.status === "installing" ? (
              <LoaderIcon className="size-3 animate-spin text-primary" />
            ) : (
              <div
                className={cn(
                  "size-1.5 rounded-full",
                  integration.status === "awaiting_config" && "bg-warning",
                  integration.status === "queued" && "bg-primary",
                  integration.status === "completed" && "bg-success",
                  integration.status === "failed" && "bg-destructive",
                  integration.status === "cancelled" && "bg-muted-foreground",
                )}
              />
            )}
            {integration.status
              .replaceAll("_", " ")
              .split(" ")
              .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
              .join(" ")}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Setup {getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>
        {renderForm()}
      </DialogContent>
    </Dialog>
  );
}
