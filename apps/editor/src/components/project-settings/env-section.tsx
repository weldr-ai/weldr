"use client";

import { useTRPC } from "@/lib/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@weldr/ui/components/card";
import { toast } from "@weldr/ui/hooks/use-toast";
import { Trash2Icon } from "lucide-react";
import { useState } from "react";
import AddEnvironmentVariableDialog from "../add-environment-variable-dialog";
import { DeleteAlertDialog } from "../delete-alert-dialog";

export function EnvSection({
  env,
  projectId,
}: { env: RouterOutputs["environmentVariables"]["list"]; projectId: string }) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const deleteEnvironmentVariable = useMutation(
    trpc.environmentVariables.delete.mutationOptions({
      onSuccess: () => {
        console.log("onSuccess");
        queryClient.invalidateQueries(
          trpc.environmentVariables.list.queryFilter(),
        );
        setDeleteDialogOpen(false);
      },
      onError: (error) => {
        console.error(error);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive",
          duration: 2000,
        });
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Environment Variables</span>
          <AddEnvironmentVariableDialog projectId={projectId} />
        </CardTitle>
        <CardDescription>
          Manage your project environment variables
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {env.map((envVar) => (
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
                }}
                isPending={deleteEnvironmentVariable.isPending}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
