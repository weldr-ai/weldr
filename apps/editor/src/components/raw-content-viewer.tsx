import type { RawContent } from "@integramind/shared/types";
import type { rawContentReferenceElementSchema } from "@integramind/shared/validators/common";
import { cn } from "@integramind/ui/utils";
import { nanoid } from "nanoid";
import { type ReactNode, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import type { z } from "zod";
import { ReferenceBadge } from "./editor/reference-badge";

type ReferenceItem = z.infer<typeof rawContentReferenceElementSchema>;

export function RawContentViewer({
  rawContent,
  className,
}: {
  rawContent: RawContent;
  className?: string;
}) {
  const { markdownText, references } = useMemo(() => {
    let text = "";
    const references: Array<Omit<ReferenceItem, "type">> = [];

    for (const item of rawContent) {
      if (item.type === "text") {
        text += item.value;
      } else {
        const placeholder = `:::REF${references.length}:::`;
        references.push(item);
        text += placeholder;
      }
    }

    return { markdownText: text, references };
  }, [rawContent]);

  const processContent = () => {
    let processedContent = markdownText;
    references.forEach((ref, index) => {
      const placeholder = `:::REF${index}:::`;
      processedContent = processedContent
        .split(placeholder)
        .join(`[REF${index}]`);
    });

    const successMatch = processedContent.match(
      /Your .+ has been built successfully!/,
    );
    const errorMatch = processedContent.match(/Your .+ has failed to build!/);

    const className = successMatch
      ? "text-success"
      : errorMatch
        ? "text-destructive"
        : "";

    const processReferences = (content: ReactNode): ReactNode => {
      if (typeof content !== "string") return content;

      const parts = content.split(/(\[REF\d+\])/);
      if (parts.length === 1) return content;

      return parts.map((part) => {
        const refMatch = part.match(/\[REF(\d+)\]/);
        if (refMatch) {
          // biome-ignore lint/style/noNonNullAssertion: <explanation>
          const refIndex = Number.parseInt(refMatch[1]!);
          return (
            <span key={nanoid()} className="inline-flex items-center">
              <ReferenceBadge
                reference={references[refIndex] as ReferenceItem}
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
            // Apply processReferences to all text-containing elements
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
            code: ({ children }) => <code>{processReferences(children)}</code>,
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
        "prose prose-headings:my-0 prose-ol:my-0 prose-p:my-0 prose-ul:my-0 cursor-text select-text prose-code:text-foreground text-foreground text-sm",
        className,
      )}
    >
      {processContent()}
    </div>
  );
}
