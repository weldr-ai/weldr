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

import type { RouterOutputs } from "@weldr/api";
import { PostgresIcon } from "@weldr/ui/icons";
import { AddIntegrationsForm } from "./add-integrations-form";

export function AddIntegrationDialog({
  integrationTemplate,
  integration,
  className,
  environmentVariables,
}: {
  integrationTemplate: RouterOutputs["integrationTemplates"]["byId"];
  integration?: RouterOutputs["projects"]["byId"]["integrations"][number];
  className?: string;
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant={integration ? "outline" : "default"}
          className={className}
        >
          {integration ? (
            <>
              {integration.name}
              <EditIcon className="ml-auto size-3.5" />
            </>
          ) : (
            <>
              {integrationTemplate.type === "postgres" && (
                <PostgresIcon className="mr-2 size-4" />
              )}
              Setup {integrationTemplate.name}
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {integration ? integration.name : "Add new integration"}
          </DialogTitle>
          <DialogDescription>
            {integration
              ? `Enter your ${integration.name} then press add.`
              : "Select an integration to add an integration."}
          </DialogDescription>
        </DialogHeader>
        <AddIntegrationsForm
          integrationTemplate={integrationTemplate}
          integration={integration}
          environmentVariables={environmentVariables}
          setDialogOpen={setDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
