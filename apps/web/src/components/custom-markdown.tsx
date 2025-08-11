"use client";

import {
  type ComponentType,
  createElement,
  type HTMLAttributes,
  isValidElement,
  memo,
  type ReactElement,
  type ReactNode,
  useCallback,
  useMemo,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { z } from "zod";

import { nanoid } from "@weldr/shared/nanoid";
import type { ChatMessageContent } from "@weldr/shared/types";
import type { referencePartSchema } from "@weldr/shared/validators/chats";
import { cn } from "@weldr/ui/lib/utils";

import { ReferenceBadge } from "./editor/reference-badge";

type ReferencePart = z.infer<typeof referencePartSchema>;

interface ProcessedContent {
  markdownText: string;
  referenceMap: Map<string, ReferencePart>;
}

interface CustomMarkdownProps {
  content: ChatMessageContent | string;
  className?: string;
}

const REFERENCE_PATTERN = /\[\[(ref-[^\]]+)\]\]/;
const REFERENCE_SPLIT_PATTERN = /(\[\[ref-[^\]]+\]\])/g;

function CustomMarkdownComponent({
  content,
  className,
}: CustomMarkdownProps): ReactElement {
  const processedContent = useMemo<ProcessedContent>(() => {
    if (typeof content === "string") {
      return { markdownText: content, referenceMap: new Map() };
    }

    let text = "";
    const referenceMap = new Map<string, ReferencePart>();

    for (const item of content) {
      if (item.type === "text") {
        text += item.text;
      } else if (
        item.type === "reference:db-model" ||
        item.type === "reference:page" ||
        item.type === "reference:endpoint"
      ) {
        const refId = `ref-${nanoid()}`;
        referenceMap.set(refId, item as ReferencePart);
        text += `[[${refId}]]`;
      }
    }

    return { markdownText: text, referenceMap };
  }, [content]);

  const processTextWithReferences = useCallback(
    (text: string): ReactNode => {
      const parts = text.split(REFERENCE_SPLIT_PATTERN);

      if (parts.length === 1) return text;

      return parts
        .map((part, index) => {
          const refMatch = part.match(REFERENCE_PATTERN);
          if (refMatch?.[1]) {
            const reference = processedContent.referenceMap.get(refMatch[1]);
            if (reference) {
              return (
                <span
                  key={`${refMatch[1]}-${index}`}
                  className="inline-flex items-center"
                >
                  <ReferenceBadge reference={reference} />
                </span>
              );
            }
            return part;
          }
          return part || null;
        })
        .filter(Boolean);
    },
    [processedContent.referenceMap],
  );

  const processNodeChildren = useCallback(
    (children: ReactNode): ReactNode => {
      if (typeof children === "string") {
        return processTextWithReferences(children);
      }

      if (Array.isArray(children)) {
        return children.map((child, index) => {
          if (typeof child === "string") {
            return processTextWithReferences(child);
          }
          if (isValidElement(child)) {
            const childElement = child as ReactElement<{
              children?: ReactNode;
            }>;
            const processedChildren = processNodeChildren(
              childElement.props.children,
            );
            if (processedChildren !== childElement.props.children) {
              return createElement(
                childElement.type,
                {
                  ...childElement.props,
                  key: childElement.key ?? index,
                },
                processedChildren,
              );
            }
          }
          return child;
        });
      }

      if (isValidElement(children)) {
        const childElement = children as ReactElement<{ children?: ReactNode }>;
        const processedChildren = processNodeChildren(
          childElement.props.children,
        );
        if (processedChildren !== childElement.props.children) {
          return createElement(
            childElement.type,
            childElement.props,
            processedChildren,
          );
        }
      }

      return children;
    },
    [processTextWithReferences],
  );

  const createWrapper = useCallback(
    (
      tag: keyof JSX.IntrinsicElements,
    ): ComponentType<
      HTMLAttributes<HTMLElement> & { children?: ReactNode }
    > => {
      return memo((props) => {
        const processedChildren = processNodeChildren(props.children);
        return createElement(tag, props, processedChildren);
      });
    },
    [processNodeChildren],
  );

  const components: Partial<Components> = useMemo(
    () => ({
      p: createWrapper("p"),
      span: createWrapper("span"),
      div: createWrapper("div"),
      li: createWrapper("li"),
      td: createWrapper("td"),
      th: createWrapper("th"),
      h1: createWrapper("h1"),
      h2: createWrapper("h2"),
      h3: createWrapper("h3"),
      h4: createWrapper("h4"),
      h5: createWrapper("h5"),
      h6: createWrapper("h6"),
      strong: createWrapper("strong"),
      em: createWrapper("em"),
      del: createWrapper("del"),
      blockquote: createWrapper("blockquote"),
      a: memo(
        (
          props: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
            children?: ReactNode;
          },
        ) => {
          const processedChildren = processNodeChildren(props.children);
          return <a {...props}>{processedChildren}</a>;
        },
      ),
      code: memo(
        (
          props: React.HTMLAttributes<HTMLElement> & { children?: ReactNode },
        ) => {
          const processedChildren = processNodeChildren(props.children);
          return <code {...props}>{processedChildren}</code>;
        },
      ),
      pre: memo(
        (
          props: React.HTMLAttributes<HTMLPreElement> & {
            children?: ReactNode;
          },
        ) => {
          return <pre {...props}>{props.children}</pre>;
        },
      ),
    }),
    [createWrapper, processNodeChildren],
  );

  return (
    <div
      className={cn("prose dark:prose-invert prose-sm max-w-none", className)}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeSanitize]}
        components={components}
      >
        {processedContent.markdownText}
      </ReactMarkdown>
    </div>
  );
}

export const CustomMarkdown = memo(CustomMarkdownComponent);
