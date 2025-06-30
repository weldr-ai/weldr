import { nanoid } from "@weldr/shared/nanoid";
import type { ChatMessageContent } from "@weldr/shared/types";
import type { referencePartSchema } from "@weldr/shared/validators/chats";
import { cn } from "@weldr/ui/lib/utils";
import DOMPurify from "dompurify";
import { type ReactNode, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { z } from "zod";
import { ReferenceBadge } from "./editor/reference-badge";

type ReferencePart = z.infer<typeof referencePartSchema>;

export function CustomMarkdown({
  content,
  className,
}: {
  content: ChatMessageContent | string;
  className?: string;
}) {
  const { markdownText, references } = useMemo(() => {
    if (typeof content === "string") {
      return { markdownText: content, references: [] };
    }

    let text = "";
    const references: Array<ReferencePart> = [];

    for (const item of content) {
      if (item.type === "text") {
        text += item.text;
      } else if (
        item.type === "reference:db-model" ||
        item.type === "reference:page" ||
        item.type === "reference:endpoint"
      ) {
        const placeholder = `:::REF${references.length}:::`;
        references.push(item);
        text += placeholder;
      }
    }

    return { markdownText: text, references };
  }, [content]);

  const processContent = () => {
    let processedContent = markdownText;
    references.forEach((ref, index) => {
      const placeholder = `:::REF${index}:::`;
      // Sanitize the reference name to prevent XSS
      const sanitizedName = DOMPurify.sanitize(
        ref.type === "reference:endpoint"
          ? `${ref.method.toUpperCase()} ${ref.path}`
          : ref.name,
      );
      processedContent = processedContent
        .split(placeholder)
        .join(`[REF${sanitizedName}]`);
    });

    const processReferences = (content: ReactNode): ReactNode => {
      if (typeof content !== "string") return content;

      const parts = content.split(/(\[REF[^\]]+\])/);
      if (parts.length === 1) return content;

      return parts.map((part) => {
        const refMatch = part.match(/\[REF([^\]]+)\]/);
        if (refMatch) {
          const refName = refMatch[1];
          const refIndex = references.findIndex(
            (ref) =>
              DOMPurify.sanitize(
                ref.type === "reference:endpoint"
                  ? `${ref.method.toUpperCase()} ${ref.path}`
                  : ref.name,
              ) === refName,
          );
          if (refIndex === -1) return part;

          return (
            <span key={nanoid()} className="inline-flex items-center">
              <ReferenceBadge
                reference={references[refIndex] as ReferencePart}
              />
            </span>
          );
        }
        return part;
      });
    };

    return (
      <span className={cn("inline", className)}>
        <ReactMarkdown
          components={{
            p: ({ children }) => (
              <p className="my-0">{processReferences(children)}</p>
            ),
            li: ({ children }) => (
              <li className="my-0">{processReferences(children)}</li>
            ),
            strong: ({ children }) => (
              <strong>{processReferences(children)}</strong>
            ),
            em: ({ children }) => <em>{processReferences(children)}</em>,
            h1: ({ children }) => <h1>{processReferences(children)}</h1>,
            h2: ({ children }) => <h2>{processReferences(children)}</h2>,
            h3: ({ children }) => <h3>{processReferences(children)}</h3>,
            h4: ({ children }) => <h4>{processReferences(children)}</h4>,
            h5: ({ children }) => <h5>{processReferences(children)}</h5>,
            h6: ({ children }) => <h6>{processReferences(children)}</h6>,
            a: ({ children, ...props }) => (
              <a {...props}>{processReferences(children)}</a>
            ),
            code: ({ children }) => (
              <code className="bg-destructive">
                {processReferences(children)}
              </code>
            ),
            blockquote: ({ children }) => (
              <blockquote>{processReferences(children)}</blockquote>
            ),
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </span>
    );
  };

  return (
    <div
      className={cn(
        "prose prose-headings:my-0 prose-ol:my-0 prose-p:my-0 prose-ul:my-0 cursor-text select-text prose-code:text-foreground prose-headings:text-foreground prose-strong:text-foreground text-foreground text-sm",
        className,
      )}
    >
      {processContent()}
    </div>
  );
}
