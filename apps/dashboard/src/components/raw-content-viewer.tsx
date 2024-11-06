import { createId } from "@paralleldrive/cuid2";
import type { RawContent } from "@specly/shared/types";
import { cn } from "@specly/ui/utils";
import React from "react";
import { ReferenceBadge } from "./editor/reference-badge";

export function RawContentViewer({
  rawContent,
}: {
  rawContent: RawContent;
}) {
  return (
    <p className="text-sm select-text cursor-text">
      {rawContent.map((item, idx) => (
        <span
          key={`${idx}-${item.type}`}
          className={cn({
            "text-success":
              item.type === "text" &&
              (item.value ?? "").toLowerCase().includes("successfully"),
          })}
        >
          {item.type === "text" ? (
            item.value?.split("\n").map((line, i) => (
              <React.Fragment key={createId()}>
                {line}
                {i < (item.value?.split("\n").length ?? 0) - 1 && <br />}
              </React.Fragment>
            ))
          ) : (
            <ReferenceBadge reference={item} />
          )}
        </span>
      ))}
    </p>
  );
}
