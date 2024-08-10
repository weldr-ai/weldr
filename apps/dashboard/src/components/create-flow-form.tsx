"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import type { FormState } from "react-hook-form";
import { useForm } from "react-hook-form";
import type { z } from "zod";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@integramind/ui/select";
import { Textarea } from "@integramind/ui/textarea";
import { toast } from "@integramind/ui/use-toast";

import type { FlowType } from "@integramind/shared/types";
import { insertFlowSchema } from "@integramind/shared/validators/flows";
import { createFlow } from "~/lib/actions/flows";

export function CreateFlowForm({
  type,
  setCreatePrimitiveDialogOpen,
}: {
  type: FlowType;
  setCreatePrimitiveDialogOpen?: (open: boolean) => void;
}) {
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, createFlowAction] = useFormState(createFlow, undefined);

  const getInitialValues = (type: FlowType) => {
    const commonInitialValues = {
      name: "",
      description: "",
      workspaceId,
    };

    switch (type) {
      case "component":
        return {
          ...commonInitialValues,
          type,
        };
      case "route":
        return {
          ...commonInitialValues,
          type,
          metadata: {
            method: undefined,
            path: "",
          },
        };
      case "workflow":
        return {
          ...commonInitialValues,
          type,
          metadata: {
            triggerType: undefined,
          },
        };
    }
  };

  const form = useForm<z.infer<typeof insertFlowSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertFlowSchema),
    defaultValues: {
      ...getInitialValues(type),
      ...(state &&
        (state.status === "error" || state.status === "validationError") &&
        state.fields),
    },
  });

  useEffect(() => {
    async function handleStateUpdate() {
      if (state) {
        if (state.status === "success") {
          form.reset();
          toast({
            title: "Success",
            description: `${type.charAt(0).toUpperCase()}${type.slice(1)} created successfully.`,
            duration: 2000,
          });
          if (setCreatePrimitiveDialogOpen) {
            setCreatePrimitiveDialogOpen(false);
          }
          router.replace(
            `/workspaces/${workspaceId}/${type}s/${state.payload.id}`,
          );
        } else if (state.status === "validationError") {
          for (const key of Object.keys(state.errors)) {
            form.setError(
              key as
                | "name"
                | "description"
                | "workspaceId"
                | "type"
                | "metadata.method"
                | "metadata.path"
                | "metadata.triggerType",
              {
                message: state.errors[key],
              },
            );
          }
          toast({
            title: "Validation Error",
            description: "Please enter fields correctly.",
            variant: "destructive",
            duration: 2000,
          });
        } else {
          toast({
            title: "Error",
            description: "Something went wrong.",
            variant: "destructive",
            duration: 2000,
          });
        }
      }
    }
    void handleStateUpdate();
  }, [form, router, setCreatePrimitiveDialogOpen, state, type, workspaceId]);

  return (
    <Form {...form}>
      <form
        action={createFlowAction}
        className="flex w-full flex-col space-y-4"
      >
        <FormField
          control={form.control}
          name={"name"}
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  placeholder={`Enter ${type} name`}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {type === "workflow" && (
          <FormField
            control={form.control}
            name="metadata.triggerType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">Type</FormLabel>
                <FormControl>
                  <Select
                    name={field.name}
                    defaultValue={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="bg-background">
                      <SelectValue placeholder="Trigger Type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="schedule">Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}
        {type === "route" && (
          <>
            <FormField
              control={form.control}
              name="metadata.method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">HTTP Method</FormLabel>
                  <FormControl>
                    <Select
                      name={field.name}
                      defaultValue={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="HTTP Method" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="get">GET</SelectItem>
                        <SelectItem value="post">POST</SelectItem>
                        <SelectItem value="patch">PATCH</SelectItem>
                        <SelectItem value="delete">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="metadata.path"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">URL Path</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      placeholder="Enter action URL path"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
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
                <Textarea
                  {...field}
                  placeholder="Enter workflow description"
                  value={field.value ?? ""}
                />
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
          name="type"
          render={({ field }) => <Input {...field} className="hidden" />}
        />
        <div className="flex w-full justify-end">
          <SubmitButton formState={form.formState} />
        </div>
      </form>
    </Form>
  );
}

function SubmitButton({
  formState,
}: {
  formState: FormState<z.infer<typeof insertFlowSchema>>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={!formState.isValid || pending}
      disabled={!formState.isValid || pending}
    >
      {pending && <Loader2Icon className="mr-1 size-3 animate-spin" />}
      Create
    </Button>
  );
}
