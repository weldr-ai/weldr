"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@weldr/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@weldr/ui/form";
import { Input } from "@weldr/ui/input";
import { RadioGroup, RadioGroupItem } from "@weldr/ui/radio-group";

import type { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@weldr/api";
import type { Integration } from "@weldr/shared/types";

const validationSchema = z.discriminatedUnion("connectionType", [
  z.object({
    connectionType: z.literal("credentials"),
    projectId: z.string(),
    integrationId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    POSTGRES_DB: z.string().min(1),
    POSTGRES_HOST: z.string().min(1),
    POSTGRES_PASSWORD: z.string().min(1),
    POSTGRES_PORT: z.string().min(1),
    POSTGRES_USER: z.string().min(1),
  }),
  z.object({
    connectionType: z.literal("url"),
    projectId: z.string(),
    integrationId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    DATABASE_URL: z.string().min(1),
  }),
]);

export function AddPostgresResourceForm({
  postgresIntegration,
  addResourceMutation,
  updateResourceMutation,
  resource,
}: {
  postgresIntegration: Pick<Integration, "id" | "name">;
  addResourceMutation: ReturnType<typeof api.resources.create.useMutation>;
  updateResourceMutation: ReturnType<typeof api.resources.update.useMutation>;
  resource?: RouterOutputs["projects"]["byId"]["resources"][number];
}) {
  const { projectId } = useParams<{ projectId: string }>();

  const defaultValues = {
    projectId,
    integrationId: postgresIntegration.id,
    name: resource?.name ?? "",
    description: resource?.description ?? "",
    connectionType: "url" as const,
  };

  const form = useForm<z.infer<typeof validationSchema>>({
    mode: "onChange",
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const connectionType = form.watch("connectionType");

  const onSubmit = async (data: z.infer<typeof validationSchema>) => {
    const environmentVariables =
      data.connectionType === "credentials"
        ? [
            { userKey: data.POSTGRES_DB, mapTo: "POSTGRES_DB" },
            { userKey: data.POSTGRES_USER, mapTo: "POSTGRES_USER" },
            { userKey: data.POSTGRES_PASSWORD, mapTo: "POSTGRES_PASSWORD" },
            { userKey: data.POSTGRES_HOST, mapTo: "POSTGRES_HOST" },
            { userKey: data.POSTGRES_PORT, mapTo: "POSTGRES_PORT" },
          ]
        : [{ userKey: data.DATABASE_URL, mapTo: "DATABASE_URL" }];

    if (resource) {
      await updateResourceMutation.mutateAsync({
        where: { id: resource.id },
        payload: {
          ...data,
          environmentVariables,
        },
      });
    } else {
      await addResourceMutation.mutateAsync({
        ...data,
        environmentVariables,
      });
    }
  };

  return (
    <Form {...form}>
      <form
        className="flex w-full flex-col space-y-4"
        onSubmit={form.handleSubmit(onSubmit)}
      >
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
          name="connectionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Connection Type</FormLabel>
              <FormControl>
                <RadioGroup
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  className="flex flex-col space-y-1"
                >
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="url" />
                    </FormControl>
                    <FormLabel className="font-normal">URL</FormLabel>
                  </FormItem>
                  <FormItem className="flex items-center space-x-3 space-y-0">
                    <FormControl>
                      <RadioGroupItem value="credentials" />
                    </FormControl>
                    <FormLabel className="font-normal">Credentials</FormLabel>
                  </FormItem>
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {connectionType === "credentials" ? (
          <>
            <FormField
              control={form.control}
              name="POSTGRES_USER"
              render={({ field }) => (
                <FormItem className="grid grid-cols-[150px_1fr] items-center gap-y-2 space-y-0">
                  <div className="flex h-9 items-center rounded-l-md border-y border-l px-3 font-mono text-xs">
                    POSTGRES_USER
                  </div>
                  <FormControl>
                    <Input
                      className="rounded-l-none"
                      {...field}
                      placeholder="Enter database user"
                    />
                  </FormControl>
                  <FormMessage className="col-span-2" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="POSTGRES_PASSWORD"
              render={({ field }) => (
                <FormItem className="grid grid-cols-[150px_1fr] items-center gap-y-2 space-y-0">
                  <div className="flex h-9 items-center rounded-l-md border-y border-l px-3 font-mono text-xs">
                    POSTGRES_PASSWORD
                  </div>
                  <FormControl>
                    <Input
                      {...field}
                      type="password"
                      className="rounded-l-none"
                      placeholder="Enter database password"
                    />
                  </FormControl>
                  <FormMessage className="col-span-2" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="POSTGRES_HOST"
              render={({ field }) => (
                <FormItem className="grid grid-cols-[150px_1fr] items-center gap-y-2 space-y-0">
                  <div className="flex h-9 items-center rounded-l-md border-y border-l px-3 font-mono text-xs">
                    POSTGRES_HOST
                  </div>
                  <FormControl>
                    <Input
                      className="rounded-l-none"
                      {...field}
                      placeholder="Enter database host"
                    />
                  </FormControl>
                  <FormMessage className="col-span-2" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="POSTGRES_PORT"
              render={({ field }) => (
                <FormItem className="grid grid-cols-[150px_1fr] items-center gap-y-2 space-y-0">
                  <div className="flex h-9 items-center rounded-l-md border-y border-l px-3 font-mono text-xs">
                    POSTGRES_PORT
                  </div>
                  <FormControl>
                    <Input
                      className="rounded-l-none"
                      {...field}
                      placeholder="Enter database port"
                    />
                  </FormControl>
                  <FormMessage className="col-span-2" />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="POSTGRES_DB"
              render={({ field }) => (
                <FormItem className="grid grid-cols-[150px_1fr] items-center gap-y-2 space-y-0">
                  <div className="flex h-9 items-center rounded-l-md border-y border-l px-3 font-mono text-xs">
                    POSTGRES_DB
                  </div>
                  <FormControl>
                    <Input
                      className="rounded-l-none"
                      {...field}
                      placeholder="Enter database name"
                    />
                  </FormControl>
                  <FormMessage className="col-span-2" />
                </FormItem>
              )}
            />
          </>
        ) : (
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
                    placeholder="Enter database URL"
                  />
                </FormControl>
                <FormMessage className="col-span-2" />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="projectId"
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
            disabled={
              !form.formState.isValid ||
              addResourceMutation.isPending ||
              !form.formState.isDirty
            }
          >
            {addResourceMutation.isPending && (
              <LoaderIcon className="mr-1 size-3 animate-spin" />
            )}
            {resource ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
