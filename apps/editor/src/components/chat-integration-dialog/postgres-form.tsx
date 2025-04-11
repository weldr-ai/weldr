"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderIcon, XIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useProject } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@weldr/api";
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
  integrationTemplateId: z.string(),
  name: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

interface PostgresFormProps {
  integrationTemplate: RouterOutputs["integrationTemplates"]["byId"];
  onSuccess?: () => void;
  onCancel?: () => void;
  onClose: () => void;
}

export function PostgresForm({
  integrationTemplate,
  onSuccess,
  onCancel,
  onClose,
}: PostgresFormProps) {
  const { project } = useProject();

  const addIntegrationMutation = api.integrations.create.useMutation({
    onSuccess: () => {
      onSuccess?.();
      onClose();
    },
  });

  const form = useForm<z.infer<typeof validationSchema>>({
    mode: "onChange",
    resolver: zodResolver(validationSchema),
    defaultValues: {
      integrationTemplateId: integrationTemplate.id,
      name: "Main Database",
      DATABASE_URL: "",
    },
  });

  const onSubmit = async (data: z.infer<typeof validationSchema>) => {
    await addIntegrationMutation.mutateAsync({
      ...data,
      projectId: project.id,
      environmentVariableMappings: [
        { envVarId: data.DATABASE_URL, configKey: "DATABASE_URL" },
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
          name="integrationTemplateId"
          render={({ field }) => <Input {...field} className="hidden" />}
        />

        <div className="flex w-full justify-between gap-2">
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                !form.formState.isValid ||
                addIntegrationMutation.isPending ||
                !form.formState.isDirty
              }
            >
              {addIntegrationMutation.isPending && (
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
