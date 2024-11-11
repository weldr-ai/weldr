import { createId } from "@paralleldrive/cuid2";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

export const JsonViewer = ({
  data,
  initialExpanded = true,
  level = 0,
}: {
  data: unknown;
  initialExpanded?: boolean;
  level?: number;
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const type = Array.isArray(data) ? "array" : typeof data;

  // Render different types of values
  const renderValue = () => {
    switch (type) {
      case "string":
        return <span className="text-success">"{data as string}"</span>;
      case "number":
        return <span className="text-primary">{data as number}</span>;
      case "boolean":
        return (
          <span className="text-foreground">
            {(data as boolean).toString()}
          </span>
        );
      case "undefined":
        return <span className="text-foreground">undefined</span>;
      case "object":
        if (data === null) return <span className="text-foreground">null</span>;
        return renderObject();
      case "array":
        return renderArray();
      default:
        return <span>{String(data)}</span>;
    }
  };

  // Render expandable section for objects and arrays
  const renderExpandable = (content: React.ReactNode, length: number) => {
    const isObj = type === "object";
    const prefix = isObj ? "{" : "[";
    const suffix = isObj ? "}" : "]";

    return (
      <div className="w-full h-full">
        <div
          className="flex w-full items-center cursor-pointer hover:bg-accent rounded px-1"
          onClick={() => setIsExpanded(!isExpanded)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              setIsExpanded(!isExpanded);
            }
          }}
          role="button"
          tabIndex={0}
        >
          {isExpanded ? (
            <ChevronDown className="size-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-4 text-muted-foreground" />
          )}
          <span className="text-muted-foreground">{prefix}</span>
          {!isExpanded && (
            <span className="text-muted-foreground">
              {length} {length === 1 ? "item" : "items"}
            </span>
          )}
          {!isExpanded && (
            <span className="text-muted-foreground">{suffix}</span>
          )}
        </div>

        {isExpanded && (
          <>
            <div className="ml-4">{content}</div>
            <span className="ml-5 text-muted-foreground">{suffix}</span>
          </>
        )}
      </div>
    );
  };

  // Render object
  const renderObject = () => {
    const entries = Object.entries(data as Record<string, unknown>);
    const content = entries.map(([key, value], index) => (
      <div key={key} className="flex ml-6">
        <span className="text-warning">"{key}"</span>
        <span className="mr-1">:</span>
        <JsonViewer
          data={value}
          level={level + 1}
          initialExpanded={initialExpanded}
        />
      </div>
    ));
    return renderExpandable(content, entries.length);
  };

  // Render array
  const renderArray = () => {
    const content = (data as unknown[]).map((item, index) => (
      <div key={createId()} className="flex">
        <JsonViewer
          data={item}
          level={level + 1}
          initialExpanded={initialExpanded}
        />
      </div>
    ));
    return renderExpandable(content, (data as unknown[]).length);
  };

  return (
    <div className="flex w-full h-full font-mono text-xs">{renderValue()}</div>
  );
};
