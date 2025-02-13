"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderIcon, XIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useProject } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import type { Integration } from "@weldr/shared/types";
import { Button } from "@weldr/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@weldr/ui/form";
import { Input } from "@weldr/ui/input";

const validationSchema = z.object({
  integrationId: z.string(),
  name: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

interface PostgresFormProps {
  integration: Pick<Integration, "id" | "name" | "type">;
  onSuccess?: () => void;
  onCancel?: () => void;
  onClose: () => void;
}

export function PostgresForm({
  integration,
  onSuccess,
  onCancel,
  onClose,
}: PostgresFormProps) {
  const { project } = useProject();

  const addResourceMutation = api.resources.create.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  const form = useForm<z.infer<typeof validationSchema>>({
    mode: "onChange",
    resolver: zodResolver(validationSchema),
    defaultValues: {
      integrationId: integration.id,
      name: "Main Database",
      DATABASE_URL: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof validationSchema>) => {
    await addResourceMutation.mutateAsync({
      ...data,
      projectId: project.id,
      environmentVariables: [
        { userKey: data.DATABASE_URL, mapTo: "DATABASE_URL" },
      ],
    });
  };

  return (
    <Form {...form}>
      <form
        className="flex w-full flex-col space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          control={form.control}
          name="DATABASE_URL"
          render={({ field }) => (
            <FormItem className="grid grid-cols-[150px_1fr] items-center gap-y-2 space-y-0">
              <div className="flex h-9 items-center rounded-l-md border-y border-l px-3 font-mono text-xs">
                DATABASE_URL
              </div>
              <FormControl>
                <Input
                  className="rounded-l-none"
                  {...field}
                  placeholder="postgres://user:password@host:port/db"
                />
              </FormControl>
              <FormMessage className="col-span-2" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="integrationId"
          render={({ field }) => <Input {...field} className="hidden" />}
        />

        <div className="flex w-full justify-between gap-2">
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                !form.formState.isValid ||
                addResourceMutation.isPending ||
                !form.formState.isDirty
              }
            >
              {addResourceMutation.isPending && (
                <LoaderIcon className="mr-1 size-3 animate-spin" />
              )}
              Continue
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onCancel?.();
              }}
            >
              <div className="mr-2 flex items-center justify-center rounded-full bg-destructive p-0.5">
                <XIcon className="size-2 text-destructive-foreground" />
              </div>
              Cancel
            </Button>
          </div>
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </form>
    </Form>
  );
}
