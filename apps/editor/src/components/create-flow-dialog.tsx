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

import type { FlowType } from "@integramind/shared/types";
import { CreateFlowForm } from "~/components/create-flow-form";

export function CreateFlowDialog({ type }: { type: FlowType }) {
  const [createFlowDialogOpen, setCreateFlowDialogOpen] = useState(false);

  return (
    <Dialog open={createFlowDialogOpen} onOpenChange={setCreateFlowDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-xs">
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
          setCreateFlowDialogOpen={setCreateFlowDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
