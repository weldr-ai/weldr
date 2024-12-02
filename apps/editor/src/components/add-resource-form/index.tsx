"use client";

import { toast } from "@integramind/ui/use-toast";

import type { Integration } from "@integramind/shared/types";
import { api } from "~/lib/trpc/client";
import { AddPostgresResourceForm } from "./add-postgres-resourc-form";

export function AddResourceForm({
  integration,
  setAddResourceDialogOpen,
}: {
  integration: Omit<Integration, "dependencies">;
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

  switch (integration.type) {
    case "postgres": {
      return (
        <AddPostgresResourceForm
          postgresIntegration={integration}
          addResourceMutation={addResourceMutation}
        />
      );
    }
  }
}
