import type { JsonSchema } from "@weldr/shared/types";
import { Button } from "@weldr/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/components/dialog";
import { TestTubeDiagonalIcon } from "lucide-react";
import { useState } from "react";
import { JsonSchemaForm } from "./json-schema-form";

export function TestInputDialog({
  schema,
  onSubmit,
  formData,
  setFormData,
}: {
  schema: JsonSchema;
  onSubmit: () => void;
  formData?: unknown;
  setFormData: (data: unknown) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground hover:text-muted-foreground"
        >
          <TestTubeDiagonalIcon className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test input</DialogTitle>
          <DialogDescription>
            Enter an input to test the function with.
          </DialogDescription>
        </DialogHeader>
        <JsonSchemaForm
          schema={schema}
          formData={formData}
          setFormData={setFormData}
          onSubmit={() => {
            onSubmit();
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
