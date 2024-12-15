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

import type { RouterOutputs } from "@integramind/api";
import type {
  EnvironmentVariable,
  Integration,
} from "@integramind/shared/types";
import { insertResourceSchema } from "@integramind/shared/validators/resources";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import type { api } from "~/lib/trpc/client";
import AddEnvironmentVariableDialog from "../add-environment-variable-dialog";

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
  env,
  addResourceMutation,
  updateResourceMutation,
  resourceEnvironmentVariables,
  resource,
}: {
  postgresIntegration: Pick<Integration, "id" | "name">;
  env: Pick<EnvironmentVariable, "key">[];
  addResourceMutation: ReturnType<typeof api.resources.create.useMutation>;
  updateResourceMutation: ReturnType<typeof api.resources.update.useMutation>;
  resourceEnvironmentVariables?: {
    mapTo: string;
    userKey: string;
  }[];
  resource?: RouterOutputs["workspaces"]["byId"]["resources"][number];
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();

  const defaultValues = {
    workspaceId,
    integrationId: postgresIntegration.id,
    name: resource?.name ?? "",
    description: resource?.description ?? "",
    ...(resourceEnvironmentVariables?.reduce(
      (acc, variable) => {
        acc[variable.mapTo] = variable.userKey;
        return acc;
      },
      {} as Record<string, string>,
    ) ?? {}),
  };

  const form = useForm<z.infer<typeof validationSchema>>({
    mode: "onChange",
    resolver: zodResolver(validationSchema),
    defaultValues,
  });

  const onSubmit = async (data: z.infer<typeof validationSchema>) => {
    const environmentVariables = [
      {
        userKey: data.POSTGRES_DB,
        mapTo: "POSTGRES_DB",
      },
      {
        userKey: data.POSTGRES_USER,
        mapTo: "POSTGRES_USER",
      },
      {
        userKey: data.POSTGRES_PASSWORD,
        mapTo: "POSTGRES_PASSWORD",
      },
      {
        userKey: data.POSTGRES_HOST,
        mapTo: "POSTGRES_HOST",
      },
      {
        userKey: data.POSTGRES_PORT,
        mapTo: "POSTGRES_PORT",
      },
    ];

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
          name="POSTGRES_USER"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Database User</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  <Select
                    {...field}
                    onValueChange={(value) => field.onChange(value)}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {env.map((e) => (
                        <SelectItem key={e.key} value={e.key}>
                          {e.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AddEnvironmentVariableDialog workspaceId={workspaceId} />
                </div>
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
                <div className="flex gap-2">
                  <Select
                    {...field}
                    onValueChange={(value) => field.onChange(value)}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {env.map((e) => (
                        <SelectItem key={e.key} value={e.key}>
                          {e.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AddEnvironmentVariableDialog workspaceId={workspaceId} />
                </div>
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
                <div className="flex gap-2">
                  <Select
                    {...field}
                    onValueChange={(value) => field.onChange(value)}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {env.map((e) => (
                        <SelectItem key={e.key} value={e.key}>
                          {e.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AddEnvironmentVariableDialog workspaceId={workspaceId} />
                </div>
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
                <div className="flex gap-2">
                  <Select
                    {...field}
                    onValueChange={(value) => field.onChange(value)}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {env.map((e) => (
                        <SelectItem key={e.key} value={e.key}>
                          {e.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AddEnvironmentVariableDialog workspaceId={workspaceId} />
                </div>
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
                <div className="flex gap-2">
                  <Select
                    {...field}
                    onValueChange={(value) => field.onChange(value)}
                    value={field.value}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select environment variable" />
                    </SelectTrigger>
                    <SelectContent>
                      {env.map((e) => (
                        <SelectItem key={e.key} value={e.key}>
                          {e.key}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <AddEnvironmentVariableDialog workspaceId={workspaceId} />
                </div>
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
              !form.formState.isValid ||
              addResourceMutation.isPending ||
              !form.formState.isDirty
            }
            disabled={
              !form.formState.isValid ||
              addResourceMutation.isPending ||
              !form.formState.isDirty
            }
          >
            {addResourceMutation.isPending && (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            )}
            {resource ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
