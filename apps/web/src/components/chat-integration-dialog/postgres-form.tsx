"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, LoaderIcon, PlusIcon, XIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useTRPC } from "@/lib/trpc/react";

import type { RouterOutputs } from "@weldr/api";
import { Button } from "@weldr/ui/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@weldr/ui/components/command";
import {
  Form,
  FormField,
  FormItem,
  FormMessage,
} from "@weldr/ui/components/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@weldr/ui/components/popover";
import { cn } from "@weldr/ui/lib/utils";
import AddEnvironmentVariableDialog from "../add-environment-variable-dialog";

const validationSchema = z.object({
  DATABASE_URL: z.string().min(1),
});

interface PostgresFormProps {
  integrationId: string;
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  onSuccess: () => void;
  onCancel: () => void;
  onClose: () => void;
}

export function PostgresForm({
  integrationId,
  environmentVariables,
  onSuccess,
  onCancel,
  onClose,
}: PostgresFormProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [isEnvVarOpen, setIsEnvVarOpen] = useState(false);

  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const { data: envVars } = useQuery(
    trpc.environmentVariables.list.queryOptions(
      {
        projectId,
      },
      {
        initialData: environmentVariables,
      },
    ),
  );

  const updateIntegrationMutation = useMutation(
    trpc.integrations.update.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.integrations.byId.queryKey({ id: integrationId }),
        });
        onSuccess();
        onClose();
      },
    }),
  );

  const form = useForm<z.infer<typeof validationSchema>>({
    mode: "onChange",
    resolver: zodResolver(validationSchema),
    defaultValues: {
      DATABASE_URL: "",
    },
  });

  const { isDirty, isValid } = form.formState;

  const onSubmit = async (data: z.infer<typeof validationSchema>) => {
    await updateIntegrationMutation.mutateAsync({
      where: { id: integrationId },
      payload: {
        status: "completed",
        environmentVariableMappings: [
          { envVarId: data.DATABASE_URL, configKey: "DATABASE_URL" },
        ],
      },
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
            <FormItem className="grid grid-cols-2 items-center gap-0 gap-y-2 space-y-0 text-xs">
              <div className="flex h-9 items-center rounded-l-md border-y border-l px-3">
                DATABASE_URL
              </div>
              <div className="flex">
                <Popover open={isEnvVarOpen} onOpenChange={setIsEnvVarOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      aria-expanded={isEnvVarOpen}
                      className="w-full justify-between rounded-l-none text-xs"
                    >
                      {field.value
                        ? envVars.find((env) => env.id === field.value)?.key
                        : "Select environment variable"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[230px] p-0">
                    <Command>
                      <CommandInput
                        className="h-8 text-xs"
                        placeholder="Search environment variables..."
                      />
                      <CommandList className="min-h-[150px] overflow-y-auto">
                        <CommandEmpty className="text-xs">
                          No environment variables found.
                        </CommandEmpty>
                        <CommandGroup>
                          {envVars.map((env) => (
                            <CommandItem
                              key={env.id}
                              value={env.key}
                              onSelect={() => {
                                form.setValue("DATABASE_URL", env.id, {
                                  shouldDirty: true,
                                  shouldValidate: true,
                                  shouldTouch: true,
                                });
                                setIsEnvVarOpen(false);
                              }}
                              className="text-xs"
                            >
                              <CheckIcon
                                className={cn(
                                  "mr-1.5 size-3.5",
                                  env.id === field.value && "opacity-100",
                                )}
                              />
                              {env.key}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                    <AddEnvironmentVariableDialog projectId={projectId}>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full justify-start rounded-none rounded-b-md border-x-0 border-b-0 text-xs"
                      >
                        <PlusIcon className="mr-1 size-3.5" />
                        Add new environment
                      </Button>
                    </AddEnvironmentVariableDialog>
                  </PopoverContent>
                </Popover>
              </div>
              <FormMessage className="col-span-2" />
            </FormItem>
          )}
        />

        <div className="flex w-full justify-between gap-2">
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={
                updateIntegrationMutation.isPending || !isValid || !isDirty
              }
            >
              {updateIntegrationMutation.isPending && (
                <LoaderIcon className="mr-1 size-3 animate-spin" />
              )}
              Continue
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onClose();
                onCancel();
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
