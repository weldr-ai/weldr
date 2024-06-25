import type { TextNode } from "lexical";
import { useCallback, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { useQuery } from "@tanstack/react-query";
import {
  ColumnsIcon,
  HashIcon,
  TableIcon,
  TextIcon,
  VariableIcon,
} from "lucide-react";
import * as ReactDOM from "react-dom";

import { ScrollArea } from "@integramind/ui/scroll-area";
import { cn } from "@integramind/ui/utils";

import type { ReferenceNode } from "~/components/editor/nodes/reference-node";
import type { DataResourceMetadata, Input } from "~/types";
import { $createReferenceNode } from "~/components/editor/nodes/reference-node";
import { PostgresIcon } from "~/components/icons/postgres-icon";
import {
  getDataResourceById,
  getDataResources,
} from "~/lib/queries/data-resources";

export class ReferenceOption extends MenuOption {
  // The id of the reference
  id: string;
  // What shows up in the editor
  name: string;
  // Reference type
  referenceType: "input" | "database" | "database-table" | "database-column";
  // Data type
  dataType?: "text" | "number";
  // Icon for display
  icon:
    | "database-icon"
    | "number-icon"
    | "text-icon"
    | "value-icon"
    | "database-column-icon"
    | "database-table-icon";
  // For extra searching.
  keywords: string[];
  // What happens when you select this option?
  onSelect: (queryString: string) => void;

  constructor(
    id: string,
    name: string,
    referenceType: "input" | "database" | "database-table" | "database-column",
    options: {
      icon:
        | "database-icon"
        | "number-icon"
        | "text-icon"
        | "value-icon"
        | "database-column-icon"
        | "database-table-icon";
      keywords?: string[];
      onSelect: (queryString: string) => void;
    },
    dataType?: "text" | "number",
  ) {
    super(name);
    this.id = id;
    this.name = name;
    this.referenceType = referenceType;
    this.dataType = dataType;
    this.icon = options.icon;
    this.keywords = options.keywords ?? [];
    this.onSelect = options.onSelect.bind(this);
  }
}

export function ReferencesPlugin({ inputs }: { inputs: Input[] }) {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [editor] = useLexicalComposerContext();
  const [queryString, setQueryString] = useState<string | null>(null);
  const [dataResourceId, setDataResourceId] = useState<string | undefined>();

  // FIXME: add all the data resources options directly to the dropdown
  const { data: dataResources } = useQuery({
    queryKey: ["data-resources"],
    queryFn: () => getDataResources({ workspaceId }),
  });

  const { data: dataResource } = useQuery({
    queryKey: ["data-resource", dataResourceId],
    queryFn: () => getDataResourceById({ id: dataResourceId! }),
    enabled: !!dataResourceId,
  });

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  const onQueryChange = useCallback(
    (matchingString: string | null) => {
      setQueryString(matchingString);
    },
    [setQueryString],
  );

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
            selectedOption.icon,
            selectedOption.dataType,
          );
        } else {
          referenceNode = $createReferenceNode(
            selectedOption.id,
            selectedOption.name,
            selectedOption.referenceType,
            selectedOption.icon,
          );
        }
        if (selectedOption.referenceType === "database") {
          setDataResourceId(selectedOption.id);
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
    console.log(inputs);
    return inputs.map(
      (input) =>
        new ReferenceOption(
          input.id,
          input.name,
          "input",
          {
            icon: input.type === "number" ? "number-icon" : "text-icon",
            keywords: ["input", input.name],
            onSelect: (queryString) => {
              console.log(queryString);
            },
          },
          input.type,
        ),
    );
  }, [inputs]);

  const options = useMemo(() => {
    const options: ReferenceOption[] = [...inputOptions];

    if (dataResource) {
      if (dataResource.provider === "postgres") {
        options.push(
          new ReferenceOption(dataResource.id, dataResource.name, "database", {
            icon: "database-icon",
            keywords: ["postgres", "data-resource", dataResource.name],
            onSelect: (queryString) => {
              console.log(queryString);
            },
          }),
        );

        (dataResource.metadata as DataResourceMetadata).tables.forEach(
          (table) => {
            table.columns.forEach((column) =>
              options.push(
                new ReferenceOption(
                  `${table.name}.${column.name}`,
                  `${table.name}.${column.name}`,
                  "database-column",
                  {
                    icon: "database-column-icon",
                    keywords: ["column", dataResource.name, column.name],
                    onSelect: (queryString) => {
                      console.log(queryString);
                    },
                  },
                  column.type === "text" ? "text" : "number",
                ),
              ),
            );
            options.push(
              new ReferenceOption(table.name, table.name, "database-table", {
                icon: "database-table-icon",
                keywords: ["table", dataResource.name, table.name],
                onSelect: (queryString) => {
                  console.log(queryString);
                },
              }),
            );
          },
        );
      }
    } else if (dataResources && !dataResourceId) {
      dataResources.forEach((dataResource) =>
        options.push(
          new ReferenceOption(dataResource.id, dataResource.name, "database", {
            icon: "database-icon",
            keywords: ["data resource", "database", dataResource.name],
            onSelect: (queryString) => {
              console.log(queryString);
            },
          }),
        ),
      );
    }

    if (!queryString) {
      return options;
    }

    const regex = new RegExp(queryString, "i");

    return options.filter(
      (option) =>
        regex.test(option.name) ||
        option.keywords.some((keyword) => regex.test(keyword)),
    );
  }, [dataResource, dataResourceId, dataResources, inputOptions, queryString]);

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
            <div>
              <ScrollArea className="h-full w-56 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
                <ul className="max-h-40">
                  {options.map((option, i: number) => (
                    <li
                      id={"menu-item-" + i}
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
                      {option.icon === "database-icon" ? (
                        <PostgresIcon className="size-3 text-primary" />
                      ) : option.icon === "value-icon" ? (
                        <VariableIcon className="size-3 text-primary" />
                      ) : option.icon === "number-icon" ? (
                        <HashIcon className="size-3 text-primary" />
                      ) : option.icon === "text-icon" ? (
                        <TextIcon className="size-3 text-primary" />
                      ) : option.icon === "database-column-icon" ? (
                        <ColumnsIcon className="size-3 text-primary" />
                      ) : option.icon === "database-table-icon" ? (
                        <TableIcon className="size-3 text-primary" />
                      ) : (
                        <></>
                      )}
                      <span className="text">{option.name}</span>
                    </li>
                  ))}
                </ul>
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
