import { db, eq } from "@weldr/db";
import { declarations } from "@weldr/db/schema";
import type { ChatMessage } from "@weldr/shared/types";
import type { CoreMessage, ToolContent } from "ai";
import { formatDeclarationSpecs } from "./formetters";

export async function convertMessagesToCore(messages: ChatMessage[]) {
  const result: CoreMessage[] = [];

  for (const message of messages) {
    // Skip tool messages as they are converted by default
    if (message.role === "tool") {
      result.push({
        role: "tool",
        content: message.content.reduce((acc: ToolContent, c) => {
          if (c.type === "tool-result") {
            acc.push({
              type: "tool-result",
              toolName: c.toolName,
              toolCallId: c.toolCallId,
              result: c.result,
            });
          }
          return acc;
        }, []),
      });
    }

    const content = message.content ?? [];

    // Process content in order, accumulating text content
    let currentTextContent = "";

    const flushTextContent = () => {
      if (currentTextContent.trim()) {
        result.push({
          role: message.role as "user" | "assistant",
          content: [{ type: "text", text: currentTextContent }],
        });
        currentTextContent = "";
      }
    };

    for (const item of content) {
      if (item.type === "text") {
        currentTextContent += item.text;
      }

      if (
        item.type === "reference:db-model" ||
        item.type === "reference:page" ||
        item.type === "reference:endpoint"
      ) {
        const reference = await db.query.declarations.findFirst({
          where: eq(declarations.id, item.id),
        });

        if (!reference) {
          continue;
        }

        if (reference) {
          currentTextContent += formatDeclarationSpecs(reference);
        }
      }

      if (item.type === "file") {
        // Flush any accumulated text content before adding the file
        flushTextContent();

        result.push({
          role: message.role as "user",
          content: [{ type: "file", data: item.data, mimeType: item.mimeType }],
        });
      }

      if (item.type === "image") {
        // Flush any accumulated text content before adding the image
        flushTextContent();

        result.push({
          role: message.role as "user",
          content: [
            { type: "image", image: item.image, mimeType: item.mimeType },
          ],
        });
      }

      if (item.type === "tool-call") {
        result.push({
          role: message.role as "assistant",
          content: [
            {
              type: "tool-call",
              toolName: item.toolName,
              args: item.args,
              toolCallId: item.toolCallId,
            },
          ],
        });
      }
    }

    // Flush any remaining text content
    flushTextContent();
  }

  return result;
}
