"use client";

import { Button } from "@weldr/ui/button";
import type { ChatRequestOptions, CreateMessage, Message } from "ai";
import { motion } from "framer-motion";
import { memo } from "react";

interface SuggestedActionsProps {
  chatId: string;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
}

const suggestedActions = [
  {
    title: "AI Chat App",
    content:
      "I want to build a chat application with AI capabilities that can understand natural language, provide intelligent responses, and learn from conversations over time.",
  },
  {
    title: "E-commerce Platform",
    content:
      "I want to create an e-commerce platform with a modern UI, real-time inventory management, and AI-powered product recommendations.",
  },
  {
    title: "Learning Platform",
    content:
      "I want to build an interactive learning platform with video courses, quizzes, and progress tracking to help people master new skills.",
  },
];

function PureSuggestedActions({ chatId, append }: SuggestedActionsProps) {
  return (
    <div className="flex gap-3">
      {suggestedActions.map((suggestedAction, index) => (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className={index > 1 ? "hidden sm:block" : "block"}
        >
          <Button
            key={suggestedAction.title}
            type="button"
            variant="outline"
            className="rounded-full bg-muted"
            size="sm"
            onClick={async () => {
              window.history.replaceState({}, "", `/projects/${chatId}`);
              append({
                role: "user",
                content: suggestedAction.content,
              });
            }}
          >
            {suggestedAction.title}
          </Button>
        </motion.div>
      ))}
    </div>
  );
}

export const SuggestedActions = memo(PureSuggestedActions, () => true);
