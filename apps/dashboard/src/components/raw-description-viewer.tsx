import type { RawDescription } from "@specly/shared/types";
import { cn } from "@specly/ui/utils";
import { ReferenceBadge } from "./editor/reference-badge";

export function RawDescriptionViewer({
  rawDescription,
}: {
  rawDescription: RawDescription[];
}) {
  return (
    <p className="text-sm select-text cursor-text">
      {rawDescription.map((item, idx) => (
        <span
          key={`${idx}-${item.type}`}
          className={cn({
            "text-success":
              item.type === "text" &&
              (item.value ?? "").toLowerCase().includes("successfully"),
          })}
        >
          {item.type === "text" ? (
            item.value
          ) : (
            <ReferenceBadge reference={item} />
          )}
        </span>
      ))}
    </p>
  );
}
