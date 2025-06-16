"use client";

import { useTRPC } from "@/lib/trpc/react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
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
import { Input } from "@weldr/ui/components/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@weldr/ui/components/popover";
import { cn } from "@weldr/ui/lib/utils";
import { CheckIcon, LoaderIcon, PlusIcon, XIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import AddEnvironmentVariableDialog from "../add-environment-variable-dialog";

const validationSchema = z.object({
  integrationTemplateId: z.string(),
  name: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

interface PostgresFormProps {
  integrationTemplate: RouterOutputs["integrationTemplates"]["byId"];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
  onSuccess?: () => void;
  onCancel?: () => void;
  onClose: () => void;
}

export function PostgresForm({
  integrationTemplate,
  environmentVariables,
  onSuccess,
  onCancel,
  onClose,
}: PostgresFormProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const [isEnvVarOpen, setIsEnvVarOpen] = useState(false);

  const trpc = useTRPC();

  const addIntegrationMutation = useMutation(
    trpc.integrations.create.mutationOptions({
      onSuccess: () => {
        onSuccess?.();
        onClose();
      },
    }),
  );

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
      projectId,
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
                        ? environmentVariables.find(
                            (env) => env.id === field.value,
                          )?.key
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
                          {environmentVariables.map((env) => (
                            <CommandItem
                              key={env.id}
                              value={env.key}
                              onSelect={() => {
                                form.setValue("DATABASE_URL", env.id);
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
