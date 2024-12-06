"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@integramind/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@integramind/ui/form";
import { Input } from "@integramind/ui/input";
import { Textarea } from "@integramind/ui/textarea";

import type { Integration } from "@integramind/shared/types";
import { insertResourceSchema } from "@integramind/shared/validators/resources";
import type { api } from "~/lib/trpc/client";

const validationSchema = insertResourceSchema
  .omit({
    environmentVariables: true,
  })
  .extend({
    POSTGRES_DB: z.string(),
    POSTGRES_HOST: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_PORT: z.string(),
    POSTGRES_USER: z.string(),
  });

export function AddPostgresResourceForm({
  postgresIntegration,
  addResourceMutation,
}: {
  postgresIntegration: Integration;
  addResourceMutation: ReturnType<typeof api.resources.create.useMutation>;
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const form = useForm<z.infer<typeof validationSchema>>({
    mode: "onChange",
    resolver: zodResolver(validationSchema),
    defaultValues: {
      workspaceId,
      integrationId: postgresIntegration.id,
      name: "",
      description: "",
      POSTGRES_DB: "",
      POSTGRES_HOST: "",
      POSTGRES_PASSWORD: "",
      POSTGRES_PORT: "",
      POSTGRES_USER: "",
    },
  });

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const environmentVariables = [
      {
        mappedKey: "POSTGRES_DB",
        key: "POSTGRES_DB",
        value: form.getValues().POSTGRES_DB,
      },
      {
        mappedKey: "POSTGRES_USER",
        key: "POSTGRES_USER",
        value: form.getValues().POSTGRES_USER,
      },
      {
        mappedKey: "POSTGRES_PASSWORD",
        key: "POSTGRES_PASSWORD",
        value: form.getValues().POSTGRES_PASSWORD,
      },
      {
        mappedKey: "POSTGRES_HOST",
        key: "POSTGRES_HOST",
        value: form.getValues().POSTGRES_HOST,
      },
      {
        mappedKey: "POSTGRES_PORT",
        key: "POSTGRES_PORT",
        value: form.getValues().POSTGRES_PORT,
      },
    ];

    await addResourceMutation.mutateAsync({
      ...form.getValues(),
      environmentVariables,
    });
  };

  return (
    <Form {...form}>
      <form className="flex w-full flex-col space-y-4" onSubmit={onSubmit}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  placeholder="Enter resource name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="POSTGRES_USER"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Database User</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  placeholder="Enter database user"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="POSTGRES_PASSWORD"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Database Password</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  type="password"
                  placeholder="Enter database password"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="POSTGRES_HOST"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Database Host</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  placeholder="Enter database host"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="POSTGRES_PORT"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Database Port</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  placeholder="Enter database port"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="POSTGRES_DB"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Database Name</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  autoComplete="off"
                  placeholder="Enter database name"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">
                Description{" "}
                <span className="text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Enter resource description" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="workspaceId"
          render={({ field }) => <Input {...field} className="hidden" />}
        />
        <FormField
          control={form.control}
          name="integrationId"
          render={({ field }) => <Input {...field} className="hidden" />}
        />
        <div className="flex w-full justify-end">
          <Button
            type="submit"
            aria-disabled={
              !form.formState.isValid || addResourceMutation.isPending
            }
            disabled={!form.formState.isValid || addResourceMutation.isPending}
          >
            {addResourceMutation.isPending && (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            )}
            Add
          </Button>
        </div>
      </form>
    </Form>
  );
}
