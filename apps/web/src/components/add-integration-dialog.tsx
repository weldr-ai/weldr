"use client";

import { useState } from "react";

import { Button } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/components/dialog";

import type { RouterOutputs } from "@weldr/api";
import { Badge } from "@weldr/ui/components/badge";
import { PostgresIcon } from "@weldr/ui/icons";
import { CheckCircle2Icon } from "lucide-react";
import { AddIntegrationsForm } from "./add-integrations-form";

export function AddIntegrationDialog({
  integrationTemplate,
  integration,
  environmentVariables,
}: {
  integrationTemplate: RouterOutputs["integrationTemplates"]["byId"];
  integration?: RouterOutputs["projects"]["byId"]["integrations"][number];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex size-80 w-full flex-col items-start justify-between gap-4 p-6"
        >
          <div className="flex w-full flex-col items-start gap-4">
            <div className="flex w-full justify-between">
              <div className="flex flex-col items-start gap-4">
                {integrationTemplate.key === "postgresql" ? (
                  <PostgresIcon className="size-10" />
                ) : null}
                <span className="font-semibold text-lg">
                  {integrationTemplate.name}
                </span>
              </div>
              {integration ? (
                <CheckCircle2Icon className="size-4 text-green-500" />
              ) : null}
            </div>
            <span className="text-wrap text-start text-muted-foreground">
              {integrationTemplate.description}
            </span>
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-2">
            {integrationTemplate.category.toLocaleUpperCase()}
          </Badge>
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
