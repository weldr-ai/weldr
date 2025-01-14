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
import { RadioGroup, RadioGroupItem } from "@integramind/ui/radio-group";
import { Textarea } from "@integramind/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@integramind/ui/tooltip";

import type { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@integramind/api";
import type {
  EnvironmentVariable,
  Integration,
} from "@integramind/shared/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";

const validationSchema = z.discriminatedUnion("connectionType", [
  z.object({
    connectionType: z.literal("credentials"),
    projectId: z.string(),
    integrationId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    POSTGRES_DB: z.string(),
    POSTGRES_HOST: z.string(),
    POSTGRES_PASSWORD: z.string(),
    POSTGRES_PORT: z.string(),
    POSTGRES_USER: z.string(),
  }),
  z.object({
    connectionType: z.literal("url"),
    projectId: z.string(),
    integrationId: z.string(),
    name: z.string().min(1),
    description: z.string().optional(),
    DATABASE_URL: z.string(),
  }),
]);

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
  resource?: RouterOutputs["projects"]["byId"]["resources"][number];
}) {
  const { projectId } = useParams<{ projectId: string }>();

  const defaultValues = {
    projectId,
    integrationId: postgresIntegration.id,
    name: resource?.name ?? "",
    description: resource?.description ?? "",
    connectionType: "url" as const,
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

  const connectionType = form.watch("connectionType");

  const onSubmit = async (data: z.infer<typeof validationSchema>) => {
    const environmentVariables =
      data.connectionType === "credentials"
        ? [
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
          ]
        : [
            {
              userKey: data.DATABASE_URL,
              mapTo: "DATABASE_URL",
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
                <FormItem>
                  <FormLabel className="text-xs">Database User</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Select
                              {...field}
                              onValueChange={(value) => field.onChange(value)}
                              value={field.value || ""}
                              disabled={env.length === 0}
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
                          </div>
                        </TooltipTrigger>
                        {env.length === 0 && (
                          <TooltipContent
                            side="right"
                            className="border bg-muted text-destructive"
                          >
                            <p>Add an environment variable first</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Select
                              {...field}
                              onValueChange={(value) => field.onChange(value)}
                              value={field.value || ""}
                              disabled={env.length === 0}
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
                          </div>
                        </TooltipTrigger>
                        {env.length === 0 && (
                          <TooltipContent
                            side="right"
                            className="border bg-muted text-destructive"
                          >
                            <p>Add an environment variable first</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Select
                              {...field}
                              onValueChange={(value) => field.onChange(value)}
                              value={field.value || ""}
                              disabled={env.length === 0}
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
                          </div>
                        </TooltipTrigger>
                        {env.length === 0 && (
                          <TooltipContent
                            side="right"
                            className="border bg-muted text-destructive"
                          >
                            <p>Add an environment variable first</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Select
                              {...field}
                              onValueChange={(value) => field.onChange(value)}
                              value={field.value || ""}
                              disabled={env.length === 0}
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
                          </div>
                        </TooltipTrigger>
                        {env.length === 0 && (
                          <TooltipContent
                            side="right"
                            className="border bg-muted text-destructive"
                          >
                            <p>Add an environment variable first</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
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
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="w-full">
                            <Select
                              {...field}
                              onValueChange={(value) => field.onChange(value)}
                              value={field.value || ""}
                              disabled={env.length === 0}
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
                          </div>
                        </TooltipTrigger>
                        {env.length === 0 && (
                          <TooltipContent
                            side="right"
                            className="border bg-muted text-destructive"
                          >
                            <p>Add an environment variable first</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        ) : (
          <FormField
            control={form.control}
            name="DATABASE_URL"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Connection String</FormLabel>
                <FormControl>
                  <div className="flex gap-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="w-full">
                          <Select
                            {...field}
                            onValueChange={(value) => field.onChange(value)}
                            value={field.value || ""}
                            disabled={env.length === 0}
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
                        </div>
                      </TooltipTrigger>
                      {env.length === 0 && (
                        <TooltipContent
                          side="right"
                          className="border bg-muted text-destructive"
                        >
                          <p>Add an environment variable first</p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

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
