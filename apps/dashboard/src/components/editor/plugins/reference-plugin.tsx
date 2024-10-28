"use client";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import type { TextNode } from "lexical";
import { useCallback, useMemo, useState } from "react";

import { ScrollArea } from "@specly/ui/scroll-area";
import { cn } from "@specly/ui/utils";

import type { DatabaseStructure } from "@specly/shared/integrations/postgres/index";
import type { DataType, FlatInputSchema } from "@specly/shared/types";
import type { rawDescriptionReferenceSchema } from "@specly/shared/validators/common";
import * as ReactDOM from "react-dom";
import type { z } from "zod";
import { $createReferenceNode } from "~/components/editor/nodes/reference-node";
import { useResources } from "~/lib/context/resources";
import { ReferenceBadge } from "../reference-badge";

export class ReferenceOption extends MenuOption {
  reference: z.infer<typeof rawDescriptionReferenceSchema>;
  // For extra searching.
  keywords: string[];
  // What happens when you select this option?
  onSelect: (queryString: string) => void;

  constructor({
    reference,
    options,
  }: {
    reference: z.infer<typeof rawDescriptionReferenceSchema>;
    options: {
      keywords?: string[];
      onSelect: (queryString: string) => void;
    };
  }) {
    super(reference.name);
    this.reference = reference;
    this.keywords = options.keywords ?? [];
    this.onSelect = options.onSelect.bind(this);
  }
}

export function ReferencesPlugin({
  inputSchema,
}: {
  inputSchema: FlatInputSchema[];
}) {
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const resources = useResources();

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
        const referenceNode = $createReferenceNode(selectedOption.reference);
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
        new ReferenceOption({
          reference: {
            type: "reference",
            name: `${input.path}`,
            referenceType: "input",
            dataType: input.type,
            source: "root",
          },
          options: {
            keywords: ["input", input.path],
            onSelect: (queryString) => {
              console.log(queryString);
            },
          },
        }),
    );

    for (const resource of resources ?? []) {
      options.push(
        new ReferenceOption({
          reference: {
            id: resource.id,
            type: "reference",
            name: resource.name,
            referenceType: "database",
          },
          options: {
            keywords: ["resource", "database", resource.name],
            onSelect: (queryString) => {
              console.log(queryString);
            },
          },
        }),
      );

      if (
        resource.integration.type === "postgres" ||
        resource.integration.type === "mysql"
      ) {
        const databaseStructure = resource.metadata as DatabaseStructure;

        for (const table of databaseStructure) {
          for (const column of table.columns) {
            options.push(
              new ReferenceOption({
                reference: {
                  type: "reference",
                  name: `${table.name}.${column.name}`,
                  referenceType: "database-column",
                  dataType: column.dataType as DataType,
                  database: {
                    id: resource.id,
                    name: resource.name,
                  },
                  table: table.name,
                },
                options: {
                  keywords: ["column", resource.name, column.name],
                  onSelect: (queryString) => {
                    console.log(queryString);
                  },
                },
              }),
            );
          }

          options.push(
            new ReferenceOption({
              reference: {
                type: "reference",
                name: `${table.name}`,
                referenceType: "database-table",
                database: {
                  id: resource.id,
                  name: resource.name,
                },
                columns: table.columns,
              },
              options: {
                keywords: ["table", resource.name, table.name],
                onSelect: (queryString) => {
                  console.log(queryString);
                },
              },
            }),
          );
        }
      }
    }

    return options;
  }, [inputSchema, resources]);

  const options = useMemo(() => {
    if (!queryString) {
      return inputOptions;
    }

    const regex = new RegExp(queryString, "i");

    return inputOptions.filter(
      (option) =>
        regex.test(option.reference.name) ||
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
                        reference={option.reference}
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
