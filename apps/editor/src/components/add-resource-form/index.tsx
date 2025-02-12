"use client";

import { toast } from "@weldr/ui/hooks/use-toast";

import { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@weldr/api";
import type { EnvironmentVariable, Integration } from "@weldr/shared/types";
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
  resource?: RouterOutputs["projects"]["byId"]["resources"][number];
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
          addResourceMutation={addResourceMutation}
          updateResourceMutation={updateResourceMutation}
          resource={resource}
        />
      );
    }
  }
}
