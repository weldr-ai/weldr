"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
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
import { toast } from "@integramind/ui/hooks/use-toast";
import { Input } from "@integramind/ui/input";
import { Textarea } from "@integramind/ui/textarea";

import { api } from "@/lib/trpc/client";
import { insertProjectSchema } from "@integramind/shared/validators/projects";

export function CreateProjectForm() {
  const router = useRouter();
  const form = useForm<z.infer<typeof insertProjectSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      name: "",
      description: "",
    },
  });

  const apiUtils = api.useUtils();

  const createProjectMutation = api.projects.create.useMutation({
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: "Project created successfully.",
        duration: 2000,
      });
      await apiUtils.projects.list.invalidate();
      router.push(`/projects/${data.id}`);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
        duration: 2000,
      });
    },
  });

  return (
    <Form {...form}>
      <form className="flex w-full flex-col space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs">Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter project name" {...field} />
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
                  placeholder="Enter project description"
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex w-full justify-end">
          <Button
            type="button"
            aria-disabled={
              !form.formState.isValid || createProjectMutation.isPending
            }
            disabled={
              !form.formState.isValid || createProjectMutation.isPending
            }
            onClick={async (e) => {
              e.preventDefault();
              await createProjectMutation.mutateAsync(form.getValues());
            }}
          >
            {createProjectMutation.isPending && (
              <Loader2Icon className="mr-1 size-3 animate-spin" />
            )}
            Create
          </Button>
        </div>
      </form>
    </Form>
  );
}
