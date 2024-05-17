"use client";

import type { Descendant, NodeEntry, Range } from "slate";
import type { RenderLeafProps } from "slate-react";
import { useCallback, useMemo } from "react";
import { createEditor, Text } from "slate";
import { Editable, Slate, withReact } from "slate-react";

type TokenType = "input" | "output" | "resource" | "none";

interface Token {
  type: "input" | "output" | "resource" | "none";
  content: string;
}

const tokenize = (text: string): Token[] => {
  const tokens: Token[] = [];
  let currentToken = "";
  let type: TokenType = "none";

  for (const char of text) {
    if (char === ">" || char === "?" || char === "@") {
      if (currentToken) {
        tokens.push({ content: currentToken, type: "none" });
      }
      currentToken = "";
      type = char === ">" ? "input" : char === "?" ? "output" : "resource";
      currentToken += char;
    } else if (char === " ") {
      if (currentToken) {
        tokens.push({ content: currentToken, type });
      }
      type = "none";
      currentToken = "";
    } else {
      currentToken += char;
    }
  }

  if (currentToken) {
    tokens.push({ content: currentToken, type });
  }

  return tokens;
};

const decorate = ([node, _path]: NodeEntry) => {
  if (!Text.isText(node)) {
    return [];
  }

  const ranges: (Range & Pick<Token, "type">)[] = [];
  const tokens = tokenize(node.text);
  let offset = 0;

  tokens.forEach((token) => {
    const start = node.text.indexOf(token.content, offset);
    const end = start + token.content.length;

    if (
      token.type === "input" ||
      token.type === "output" ||
      token.type == "resource"
    ) {
      ranges.push({
        anchor: { offset: start, path: [0, 0] },
        focus: { offset: end, path: [0, 0] },
        type: token.type,
      });
    }

    offset = end;
  });

  return ranges;
};

const Leaf = ({
  attributes,
  children,
  leaf,
}: RenderLeafProps & { leaf: Text & Pick<Token, "type"> }) => {
  const className = useMemo(() => {
    if (leaf.type === "input") {
      return "text-green-500";
    } else if (leaf.type === "output") {
      return "text-blue-500";
    } else if (leaf.type === "resource") {
      return "text-red-500";
    }
    return "text-foreground";
  }, [leaf]);
  return (
    <span className={className} {...attributes}>
      {children}
    </span>
  );
};

export function TextHighlighter({
  value,
  onValueChange,
}: {
  value: Descendant[];
  onValueChange: (value: Descendant[]) => void;
}) {
  const editor = useMemo(() => withReact(createEditor()), []);

  const renderLeaf = useCallback(
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    (props: RenderLeafProps) => <Leaf {...props} />,
    [],
  );

  return (
    <Slate editor={editor} initialValue={value} onValueChange={onValueChange}>
      <Editable
        className="min-h-16 w-64 flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm caret-foreground shadow-sm placeholder:text-muted-foreground focus:cursor-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        decorate={decorate}
        renderLeaf={renderLeaf}
        placeholder="Write a brief description of what this block should query a resource."
      />
    </Slate>
  );
}
