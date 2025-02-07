"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpIcon, PaperclipIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@integramind/ui/button";
import { Form, FormControl, FormField, FormItem } from "@integramind/ui/form";
import { toast } from "@integramind/ui/hooks/use-toast";
import { Textarea } from "@integramind/ui/textarea";

import { api } from "@/lib/trpc/client";
import { insertProjectSchema } from "@integramind/shared/validators/projects";
import { useEffect, useState } from "react";

const placeholders = [
  "I want to build an app that helps people learn languages...",
  "I want to create a project management tool that...",
  "I want to design a social platform where users can...",
  "I want to build an AI-powered assistant that...",
];

const quickStartTemplates = [
  {
    label: "AI Chat App",
    content:
      "I want to build a chat application with AI capabilities that can understand natural language, provide intelligent responses, and learn from conversations over time.",
  },
  {
    label: "E-commerce Platform",
    content:
      "I want to create an e-commerce platform with a modern UI, real-time inventory management, and AI-powered product recommendations.",
  },
  {
    label: "Learning Platform",
    content:
      "I want to build an interactive learning platform with video courses, quizzes, and progress tracking to help people master new skills.",
  },
];

export function CreateProjectForm() {
  const router = useRouter();
  const [placeholder, setPlaceholder] = useState("");
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const form = useForm<z.infer<typeof insertProjectSchema>>({
    mode: "onChange",
    resolver: zodResolver(insertProjectSchema),
    defaultValues: {
      message: "",
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

  useEffect(() => {
    let charIndex = 0;
    let isDeleting = false;
    const currentPlaceholder = placeholders[placeholderIndex];

    if (form.getValues("message")) {
      setPlaceholder("");
      return;
    }

    const interval = setInterval(() => {
      if (!isDeleting) {
        setPlaceholder(currentPlaceholder?.slice(0, charIndex) ?? "");
        charIndex++;

        if (charIndex > (currentPlaceholder?.length ?? 0)) {
          isDeleting = true;
          return;
        }
      } else {
        charIndex--;
        setPlaceholder(currentPlaceholder?.slice(0, charIndex) ?? "");

        if (charIndex === 0) {
          isDeleting = false;
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
          return;
        }
      }
    }, 50);

    return () => clearInterval(interval);
  }, [placeholderIndex, form]);

  return (
    <Form {...form}>
      <form
        className="flex size-full flex-col items-center justify-center gap-16"
        onSubmit={form.handleSubmit((data) =>
          createProjectMutation.mutate(data),
        )}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="font-semibold text-3xl">
            What can I forge for you today?
          </div>
          <p className="text-muted-foreground">
            Weldr will forge your visions into reality.
          </p>
        </div>
        <FormField
          control={form.control}
          name="message"
          render={({ field }) => (
            <FormItem className="relative">
              <div className="absolute inset-1 animate-pulse bg-gradient-to-r from-orange-500 via-amber-200 to-100% to-blue-500 blur-lg" />
              <FormControl>
                <Textarea
                  {...field}
                  placeholder={placeholder}
                  className="relative h-[150px] w-[650px] resize-none rounded-xl bg-background p-4 focus-visible:ring-0"
                />
              </FormControl>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="absolute bottom-3 left-3 z-50 h-7 rounded-md"
              >
                <PaperclipIcon className="mr-2 size-3" />
                Attach
              </Button>
              <Button
                type="submit"
                size="icon"
                className="absolute right-3 bottom-3 z-50 size-7 rounded-md"
                disabled={!form.formState.isDirty}
              >
                <ArrowUpIcon className="size-4" />
              </Button>
            </FormItem>
          )}
        />
        <div className="flex gap-3">
          {quickStartTemplates.map((template) => (
            <Button
              key={template.label}
              type="button"
              variant="outline"
              className="rounded-full bg-muted"
              size="sm"
              onClick={() => form.setValue("message", template.content)}
            >
              {template.label}
            </Button>
          ))}
        </div>
      </form>
    </Form>
  );
}
