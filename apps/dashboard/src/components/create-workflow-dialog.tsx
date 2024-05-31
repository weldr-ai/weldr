"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@integramind/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@integramind/ui/dialog";

import { CreateWorkflowForm } from "~/components/create-workflow-form";

export function CreateWorkflowDialog() {
  const [createWorkflowDialogOpen, setCreateWorkflowDialogOpen] =
    useState(false);

  return (
    <Dialog
      open={createWorkflowDialogOpen}
      onOpenChange={setCreateWorkflowDialogOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 size-3.5" />
          Create new workflow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Workflow</DialogTitle>
          <DialogDescription>
            Enter the workflow details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateWorkflowForm
          setCreateWorkflowDialogOpen={setCreateWorkflowDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
