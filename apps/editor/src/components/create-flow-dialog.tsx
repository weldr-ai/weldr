"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@integramind/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@integramind/ui/dialog";

import { CreateFlowForm } from "~/components/create-flow-form";

export function CreateFlowDialog() {
  const [createFlowDialogOpen, setCreateFlowDialogOpen] = useState(false);

  return (
    <Dialog open={createFlowDialogOpen} onOpenChange={setCreateFlowDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-xs">
          <PlusIcon className="mr-1.5 size-3.5" />
          Create new flow
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new flow</DialogTitle>
          <DialogDescription>
            Enter the flow details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateFlowForm setCreateFlowDialogOpen={setCreateFlowDialogOpen} />
      </DialogContent>
    </Dialog>
  );
}
