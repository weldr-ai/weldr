"use client";

import { toast } from "@integramind/ui/use-toast";

import type { RouterOutputs } from "@integramind/api";
import type {
  EnvironmentVariable,
  Integration,
} from "@integramind/shared/types";
import { api } from "~/lib/trpc/client";
import { AddPostgresResourceForm } from "./add-postgres-resource-form";

export function AddResourceForm({
  integration,
  env,
  resource,
  resourceEnvironmentVariables,
  setAddResourceDialogOpen,
}: {
  integration: Pick<Integration, "id" | "name" | "type">;
  env: Pick<EnvironmentVariable, "key">[];
  resource?: RouterOutputs["workspaces"]["byId"]["resources"][number];
  resourceEnvironmentVariables?: {
    mapTo: string;
    userKey: string;
  }[];
  setAddResourceDialogOpen?: (open: boolean) => void;
}) {
  const apiUtils = api.useUtils();

  const addResourceMutation = api.resources.create.useMutation({
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Resource created successfully.",
        duration: 2000,
      });
      if (setAddResourceDialogOpen) {
        setAddResourceDialogOpen(false);
      }
      await apiUtils.resources.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  const updateResourceMutation = api.resources.update.useMutation({
    onSuccess: async () => {
      toast({
        title: "Success",
        description: "Resource updated successfully.",
        duration: 2000,
      });
      await apiUtils.resources.list.invalidate();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  switch (integration.type) {
    case "postgres": {
      return (
        <AddPostgresResourceForm
          postgresIntegration={integration}
          env={env}
          addResourceMutation={addResourceMutation}
          updateResourceMutation={updateResourceMutation}
          resource={resource}
          resourceEnvironmentVariables={resourceEnvironmentVariables}
        />
      );
    }
  }
}
