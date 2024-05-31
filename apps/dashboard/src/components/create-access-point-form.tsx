"use client";

import type { FormState } from "react-hook-form";
import type { z } from "zod";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useFormState, useFormStatus } from "react-dom";
import { useForm } from "react-hook-form";

import { insertAccessPointSchema } from "@integramind/db/schema";
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

import { createAccessPoint } from "~/lib/actions/access-points";

export function CreateAccessPointForm({
  setCreateAccessPointDialogOpen,
}: {
  setCreateAccessPointDialogOpen?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [state, createAccessPointAction] = useFormState(
    createAccessPoint,
    undefined,
  );
  const form = useForm<z.infer<typeof insertAccessPointSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertAccessPointSchema),
    defaultValues: {
      name: "",
      description: "",
      urlPath: "",
      actionType: undefined,
      workspaceId,
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
            description: "Access point created successfully.",
            duration: 2000,
          });
          await queryClient.invalidateQueries({ queryKey: ["access-points"] });
          if (setCreateAccessPointDialogOpen) {
            setCreateAccessPointDialogOpen(false);
          }
          router.replace(
            `/workspaces/${workspaceId}/access-points/${state.payload.id}`,
          );
        } else if (state.status === "validationError") {
          Object.keys(state.errors).forEach((key) => {
            const fieldName = key as "name" | "description";
            form.setError(fieldName, {
              message: state.errors[fieldName],
            });
          });
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
  }, [
    form,
    queryClient,
    router,
    setCreateAccessPointDialogOpen,
    state,
    workspaceId,
  ]);

  return (
    <Form {...form}>
      <form
        action={createAccessPointAction}
        className="flex w-full flex-col space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter access point name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="urlPath"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">URL Path</FormLabel>
              <FormControl>
                <Input placeholder="Enter access point URL path" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="actionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Action Type</FormLabel>
              <FormControl>
                <Select
                  name={field.name}
                  defaultValue={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Action Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retrieve">Retrieve</SelectItem>
                    <SelectItem value="submit">Submit</SelectItem>
                    <SelectItem value="modify">Modify</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                  </SelectContent>
                </Select>
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
                <Textarea
                  {...field}
                  placeholder="Enter access point description"
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
  formState: FormState<z.infer<typeof insertAccessPointSchema>>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      aria-disabled={!formState.isValid || pending}
      disabled={!formState.isValid || pending}
    >
      {pending && <Loader2 className="mr-1 size-3 animate-spin" />}
      Create
    </Button>
  );
}
