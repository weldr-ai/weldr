"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@specly/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@specly/ui/dialog";

import type { FlowType } from "@specly/shared/types";
import { CreateFlowForm } from "~/components/create-flow-form";

export function CreateFlowDialog({ type }: { type: FlowType }) {
  const [createPrimitiveDialogOpen, setCreatePrimitiveDialogOpen] =
    useState(false);

  return (
    <Dialog
      open={createPrimitiveDialogOpen}
      onOpenChange={setCreatePrimitiveDialogOpen}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <PlusIcon className="mr-1.5 size-3.5" />
          Create new {type}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Create {type.charAt(0).toUpperCase() + type.slice(1)}
          </DialogTitle>
          <DialogDescription>
            Enter the {type} details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateFlowForm
          type={type}
          setCreatePrimitiveDialogOpen={setCreatePrimitiveDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
