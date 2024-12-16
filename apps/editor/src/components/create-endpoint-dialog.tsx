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

import { CreateEndpointForm } from "~/components/create-endpoint-form";

export function CreateEndpointDialog({
  size = "sm",
}: { size?: "sm" | "icon" }) {
  const [createEndpointDialogOpen, setCreateEndpointDialogOpen] =
    useState(false);

  return (
    <Dialog
      open={createEndpointDialogOpen}
      onOpenChange={setCreateEndpointDialogOpen}
    >
      <DialogTrigger asChild>
        {size === "sm" ? (
          <Button variant="outline" className="text-xs">
            <PlusIcon className="mr-1.5 size-3.5" />
            Create new endpoint
          </Button>
        ) : (
          <Button variant="outline" className="size-7 p-0">
            <PlusIcon className="size-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create new endpoint</DialogTitle>
          <DialogDescription>
            Enter the endpoint details then press create.
          </DialogDescription>
        </DialogHeader>
        <CreateEndpointForm
          setCreateEndpointDialogOpen={setCreateEndpointDialogOpen}
        />
      </DialogContent>
    </Dialog>
  );
}
