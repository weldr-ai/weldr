"use client";

import { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@integramind/api";
import { Button } from "@integramind/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@integramind/ui/card";
import { toast } from "@integramind/ui/use-toast";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import AddEnvironmentVariableDialog from "../add-environment-variable-dialog";
import { DeleteAlertDialog } from "../delete-alert-dialog";

export function EnvSection({
  project,
}: { project: RouterOutputs["projects"]["byId"] }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const apiUtils = api.useUtils();

  const { data: environmentVariables } = api.environmentVariables.list.useQuery(
    {
      projectId: project.id,
    },
    {
      initialData: project.environmentVariables,
    },
  );

  const deleteEnvironmentVariable = api.environmentVariables.delete.useMutation(
    {
      onSuccess: () => {
        apiUtils.environmentVariables.list.invalidate();
      },
      onError: (error) => {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
          duration: 2000,
        });
      },
    },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Environment Variables</span>
          <AddEnvironmentVariableDialog projectId={project.id} />
        </CardTitle>
        <CardDescription>
          Manage your project environment variables
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {environmentVariables.map((envVar) => (
            <div key={envVar.id} className="flex items-center justify-between">
              <span>{envVar.key}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2Icon className="size-4 text-destructive" />
              </Button>
              <DeleteAlertDialog
                open={deleteDialogOpen}
                setOpen={setDeleteDialogOpen}
                onDelete={() => {
                  deleteEnvironmentVariable.mutate({ id: envVar.id });
                  if (deleteEnvironmentVariable.isSuccess) {
                    setDeleteDialogOpen(false);
                  }
                }}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
