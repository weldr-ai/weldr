"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckIcon, LoaderIcon, PlusIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@weldr/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@weldr/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@weldr/ui/form";
import { Input } from "@weldr/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@weldr/ui/popover";

import type { api } from "@/lib/trpc/client";
import type { RouterOutputs } from "@weldr/api";
import { cn } from "@weldr/ui/utils";
import AddEnvironmentVariableDialog from "../add-environment-variable-dialog";

const validationSchema = z.object({
  projectId: z.string(),
  integrationId: z.string(),
  name: z.string().min(1),
  DATABASE_URL: z.string(),
});

export function AddPostgresIntegrationForm({
  postgresIntegration,
  addIntegrationMutation,
  updateIntegrationMutation,
  integration,
  environmentVariables,
}: {
  postgresIntegration: RouterOutputs["integrationTemplates"]["byId"];
  addIntegrationMutation: ReturnType<
    typeof api.integrations.create.useMutation
  >;
  updateIntegrationMutation: ReturnType<
    typeof api.integrations.update.useMutation
  >;
  integration?: RouterOutputs["projects"]["byId"]["integrations"][number];
  environmentVariables: RouterOutputs["environmentVariables"]["list"];
}) {
  const { projectId } = useParams<{ projectId: string }>();
  const [open, setOpen] = useState(false);

  const form = useForm<z.infer<typeof validationSchema>>({
    mode: "onChange",
    resolver: zodResolver(validationSchema),
    defaultValues: {
      projectId,
      integrationId: postgresIntegration.id,
      name: integration?.name ?? "",
      DATABASE_URL:
        integration?.environmentVariableMappings?.find(
          (mapping) => mapping.mapTo === "DATABASE_URL",
        )?.environmentVariableId ?? "",
    },
  });

  const onSubmit = async (data: z.infer<typeof validationSchema>) => {
    const environmentVariableMappings = [
      { envVarId: data.DATABASE_URL, configKey: "DATABASE_URL" },
    ];

    if (integration) {
      await updateIntegrationMutation.mutateAsync({
        where: { id: integration.id },
        payload: {
          ...data,
          environmentVariableMappings,
        },
      });
    } else {
      await addIntegrationMutation.mutateAsync({
        ...data,
        integrationTemplateId: postgresIntegration.id,
        environmentVariableMappings,
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
                  placeholder="Enter friendly name for your database"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="DATABASE_URL"
          render={({ field }) => (
            <FormItem className="grid grid-cols-2 items-center gap-y-2 space-y-0 text-xs">
              <div className="flex h-9 items-center rounded-l-md border-y border-l px-3">
                DATABASE_URL
              </div>
              <div className="flex">
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      aria-expanded={open}
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
                                setOpen(false);
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
                        <PlusIcon className="mr-2 size-3.5" />
                        Add new environment variable
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
              addIntegrationMutation.isPending ||
              updateIntegrationMutation.isPending ||
              !form.formState.isValid ||
              !form.formState.isDirty
            }
          >
            {addIntegrationMutation.isPending && (
              <LoaderIcon className="mr-1 size-3 animate-spin" />
            )}
            {updateIntegrationMutation.isPending && (
              <LoaderIcon className="mr-1 size-3 animate-spin" />
            )}
            {integration ? "Update" : "Add"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
