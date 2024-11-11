"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@integramind/ui/dialog";

import { CreateWorkspaceForm } from "~/components/create-workspace-form";

export function CreateWorkspaceDialog({
  open,
  setOpen,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Enter the workspace details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateWorkspaceForm />
      </DialogContent>
    </Dialog>
  );
}
