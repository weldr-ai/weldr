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

import { CreateComponentForm } from "~/components/create-component-form";

export function CreateComponentDialog() {
  const [createComponentDialogOpen, setCreateComponentDialogOpen] =
    useState(false);

  return (
    <Dialog
      open={createComponentDialogOpen}
      onOpenChange={setCreateComponentDialogOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 size-3.5" />
          Create new component
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Component</DialogTitle>
          <DialogDescription>
            Enter the component details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateComponentForm
          setCreateComponentDialogOpen={setCreateComponentDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
