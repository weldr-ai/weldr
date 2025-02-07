"use client";

import { api } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEnvironmentVariableSchema } from "@weldr/shared/validators/environment-variables";
import { Button } from "@weldr/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@weldr/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@weldr/ui/form";
import { toast } from "@weldr/ui/hooks/use-toast";
import { Input } from "@weldr/ui/input";
import { Loader2Icon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

export default function AddEnvironmentVariableDialog({
  projectId,
}: {
  projectId: string;
}) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<z.infer<typeof insertEnvironmentVariableSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertEnvironmentVariableSchema),
    defaultValues: {
      key: "",
      value: "",
      projectId,
    },
  });

  const apiUtils = api.useUtils();

  const createEnvironmentVariable = api.environmentVariables.create.useMutation(
    {
      onSuccess: (data) => {
        apiUtils.environmentVariables.list.invalidate();
        if (data.id) {
          setIsDialogOpen(false);
          form.reset();
        }
      },
      onError: (error) => {
        toast({
          title: "Error",
          variant: "destructive",
          description: error.message,
          duration: 2000,
        });
      },
    },
  );

  const onSubmit = async (
    data: z.infer<typeof insertEnvironmentVariableSchema>,
  ) => {
    createEnvironmentVariable.mutate({
      value: data.value,
      key: data.key,
      projectId,
    });
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <PlusIcon className="mr-2 size-4" />
          Add Variable
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Environment Variable</DialogTitle>
          <DialogDescription>
            Add a new environment variable to your project.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="key"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Key</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter key" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="value"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Value</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder="Enter value"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                disabled={
                  createEnvironmentVariable.isPending || !form.formState.isValid
                }
              >
                {createEnvironmentVariable.isPending && (
                  <Loader2Icon className="size-4 animate-spin" />
                )}
                Add Environment Variable
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
