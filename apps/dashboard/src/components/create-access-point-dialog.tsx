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

import { CreateAccessPointForm } from "~/components/create-access-point-form";

export function CreateAccessPointDialog() {
  const [createAccessPointDialogOpen, setCreateAccessPointDialogOpen] =
    useState(false);

  return (
    <Dialog
      open={createAccessPointDialogOpen}
      onOpenChange={setCreateAccessPointDialogOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="mr-1.5 size-3.5" />
          Create new access point
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Access Point</DialogTitle>
          <DialogDescription>
            Enter the access point details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateAccessPointForm
          setCreateAccessPointDialogOpen={setCreateAccessPointDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
