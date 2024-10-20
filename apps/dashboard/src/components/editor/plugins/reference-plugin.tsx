"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import type { TextNode } from "lexical";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { ScrollArea } from "@specly/ui/scroll-area";
import { cn } from "@specly/ui/utils";

import { createId } from "@paralleldrive/cuid2";
import type { DataType, FlatInputSchema } from "@specly/shared/types";
import { pgTypeToJsonSchemaType } from "@specly/shared/utils";
import * as ReactDOM from "react-dom";
import type { ReferenceNode } from "~/components/editor/nodes/reference-node";
import { $createReferenceNode } from "~/components/editor/nodes/reference-node";
import { api } from "~/lib/trpc/react";
import { ReferenceBadge } from "../reference-badge";

export class ReferenceOption extends MenuOption {
  // The id of the reference
  id: string;
  // What shows up in the editor
  name: string;
  // Reference type
  referenceType: "input" | "database" | "database-table" | "database-column";
  // Data type
  dataType?: DataType;
  // Test value
  testValue?: string | number | null;
  // For extra searching.
  keywords: string[];
  // What happens when you select this option?
  onSelect: (queryString: string) => void;

  constructor(
    id: string,
    name: string,
    referenceType: "input" | "database" | "database-table" | "database-column",
    options: {
      keywords?: string[];
      onSelect: (queryString: string) => void;
    },
    dataType?: DataType,
    testValue?: string | number | null,
  ) {
    super(name);
    this.id = id;
    this.name = name;
    this.referenceType = referenceType;
    this.dataType = dataType;
    this.testValue = testValue;
    this.keywords = options.keywords ?? [];
    this.onSelect = options.onSelect.bind(this);
  }
}

export function ReferencesPlugin({
  inputSchema,
}: {
  inputSchema: FlatInputSchema[];
}) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);

  const { data: workspaceResources } = api.resources.getAll.useQuery({
    workspaceId,
  });

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  const onQueryChange = useCallback((matchingString: string | null) => {
    setQueryString(matchingString);
  }, []);

  const onSelectOption = useCallback(
    (
      selectedOption: ReferenceOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      editor.update(() => {
        let referenceNode: ReferenceNode;
        if (
          selectedOption.referenceType === "input" ||
          selectedOption.referenceType === "database-column"
        ) {
          referenceNode = $createReferenceNode(
            selectedOption.id,
            selectedOption.name,
            selectedOption.referenceType,
            selectedOption.dataType,
          );
        } else {
          referenceNode = $createReferenceNode(
            selectedOption.id,
            selectedOption.name,
            selectedOption.referenceType,
          );
        }
        if (nodeToReplace) {
          nodeToReplace.replace(referenceNode);
        }
        referenceNode.decorate();
        closeMenu();
      });
    },
    [editor],
  );

  const inputOptions: ReferenceOption[] = useMemo(() => {
    const options: ReferenceOption[] = inputSchema.map(
      (input) =>
        new ReferenceOption(
          createId(),
          input.path,
          "input",
          {
            keywords: ["input", input.path],
            onSelect: (queryString) => {
              console.log(queryString);
            },
          },
          input.type,
        ),
    );

    for (const resource of workspaceResources ?? []) {
      options.push(
        new ReferenceOption(resource.id, resource.name, "database", {
          keywords: ["resource", "database", resource.name],
          onSelect: (queryString) => {
            console.log(queryString);
          },
        }),
      );

      if (
        (resource.provider === "postgres" || resource.provider === "mysql") &&
        resource.metadata.tables
      ) {
        for (const table of resource.metadata.tables) {
          for (const column of table.columns) {
            options.push(
              new ReferenceOption(
                `${table.name}.${column.name}`,
                `${table.name}.${column.name}`,
                "database-column",
                {
                  keywords: ["column", resource.name, column.name],
                  onSelect: (queryString) => {
                    console.log(queryString);
                  },
                },
                pgTypeToJsonSchemaType(column.type),
              ),
            );
          }
          options.push(
            new ReferenceOption(table.name, table.name, "database-table", {
              keywords: ["table", resource.name, table.name],
              onSelect: (queryString) => {
                console.log(queryString);
              },
            }),
          );
        }
      }
    }

    return options;
  }, [inputSchema, workspaceResources]);

  const options = useMemo(() => {
    if (!queryString) {
      return inputOptions;
    }

    const regex = new RegExp(queryString, "i");

    return inputOptions.filter(
      (option) =>
        regex.test(option.name) ||
        option.keywords.some((keyword) => regex.test(keyword)),
    );
  }, [inputOptions, queryString]);

  return (
    <LexicalTypeaheadMenuPlugin<ReferenceOption>
      onQueryChange={onQueryChange}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElementRef,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) =>
        anchorElementRef?.current && options.length ? (
          ReactDOM.createPortal(
            <div className="absolute z-50">
              <ScrollArea className="h-full w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                <div className="max-h-40">
                  {options.map((option, i: number) => (
                    <div
                      id={`menu-item-${i}`}
                      className={cn(
                        "flex w-full cursor-default select-none items-center gap-2 rounded-sm px-2 py-1.5 text-xs outline-none transition-colors focus:bg-accent focus:text-accent-foreground",
                        {
                          "bg-accent": selectedIndex === i,
                        },
                      )}
                      tabIndex={-1}
                      role="option"
                      aria-selected={selectedIndex === i}
                      onClick={() => {
                        setHighlightedIndex(i);
                        selectOptionAndCleanUp(option);
                      }}
                      onKeyUp={() => {
                        setHighlightedIndex(i);
                      }}
                      onKeyDown={() => {
                        setHighlightedIndex(i);
                      }}
                      onMouseEnter={() => {
                        setHighlightedIndex(i);
                      }}
                      key={option.key}
                    >
                      <ReferenceBadge
                        name={option.name}
                        dataType={option.dataType ?? "null"}
                        referenceType={option.referenceType}
                        className="border-none p-0 bg-transparent"
                      />
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>,
            anchorElementRef.current,
          )
        ) : (
          <div className="absolute left-3 top-8 flex min-w-48 rounded-md border bg-muted p-2 text-xs">
            No references found.
          </div>
        )
      }
    />
  );
}
