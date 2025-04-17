"use client";

import { useCommandCenter } from "@/lib/store";
import { api } from "@/lib/trpc/client";
import { createId } from "@paralleldrive/cuid2";
import type { Attachment } from "@weldr/shared/types";
import { Button } from "@weldr/ui/button";
import { toast } from "@weldr/ui/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MultimodalInput } from "./multimodal-input";

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
  const { setOpen } = useCommandCenter();
  const projectChatId = createId();

  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const createProjectMutation = api.projects.create.useMutation({
    onSuccess: async (data) => {
      toast({
        title: "Success",
        description: "Project created successfully.",
        duration: 2000,
      });
      setOpen(false);
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

  const handleSubmit = () => {
    createProjectMutation.mutate({
      chatId: projectChatId,
      message,
      attachments: attachments.map((attachment) => ({
        key: attachment.id,
        name: attachment.name,
        contentType: attachment.contentType,
        size: attachment.size,
      })),
    });
  };

  return (
    <>
      <div className="flex size-full flex-col items-center justify-center gap-16">
        <div className="flex flex-col items-center gap-4">
          <div className="font-semibold text-3xl">
            What can I forge for you today?
          </div>
          <p className="text-muted-foreground">
            Forge your visions into reality with Weldr.
          </p>
        </div>
        <div className="relative">
          <div className="absolute inset-1 animate-pulse bg-gradient-to-r from-orange-500 via-amber-200 to-100% to-blue-500 blur-lg" />
          <MultimodalInput
            chatId={projectChatId}
            handleSubmit={handleSubmit}
            pendingMessage={null}
            message={message}
            setMessage={setMessage}
            attachments={attachments}
            setAttachments={setAttachments}
            formClassName="relative border w-[650px]"
            placeholders={placeholders}
          />
        </div>
        <div className="flex gap-3">
          {quickStartTemplates.map((template) => (
            <Button
              key={template.label}
              type="button"
              variant="outline"
              className="rounded-full bg-muted"
              size="sm"
              onClick={() => setMessage(template.content)}
            >
              {template.label}
            </Button>
          ))}
        </div>
      </div>
    </>
  );
}
