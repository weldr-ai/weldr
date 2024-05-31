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

import { CreateCompoundBlockForm } from "~/components/create-compound-block-form";

export function CreateCompoundBlockDialog() {
  const [createCompoundBlockDialogOpen, setCreateCompoundBlockDialogOpen] =
    useState(false);

  return (
    <Dialog
      open={createCompoundBlockDialogOpen}
      onOpenChange={setCreateCompoundBlockDialogOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 size-3.5" />
          Create new compound block
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Compound Block</DialogTitle>
          <DialogDescription>
            Enter the compound block details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateCompoundBlockForm
          setCreateCompoundBlockDialogOpen={setCreateCompoundBlockDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
