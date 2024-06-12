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
import { DatabaseIcon, VariableIcon } from "lucide-react";

import { cn } from "@integramind/ui/utils";

import type { DataResourceNode } from "~/components/editor/nodes/data-resource-node";
import type { ValueNode } from "~/components/editor/nodes/value-node";
import type { DataResourceMetadata } from "~/types";
import { $createDataResourceNode } from "~/components/editor/nodes/data-resource-node";
import { $createValueNode } from "~/components/editor/nodes/value-node";
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
  type: "value" | "data-resource";
  // Icon for display
  icon: string;
  // For extra searching.
  keywords: string[];
  // What happens when you select this option?
  onSelect: (queryString: string) => void;

  constructor(
    id: string,
    name: string,
    type: "value" | "data-resource",
    options: {
      icon: string;
      keywords?: string[];
      onSelect: (queryString: string) => void;
    },
  ) {
    super(name);
    this.id = id;
    this.name = name;
    this.type = type;
    this.keywords = options.keywords ?? [];
    this.icon = options.icon;
    this.onSelect = options.onSelect.bind(this);
  }
}

export function ReferencesPlugin() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const [editor] = useLexicalComposerContext();
  const [_queryString, setQueryString] = useState<string | null>(null);
  const [dataResourceId, setDataResourceId] = useState<string | undefined>();

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
        let referenceNode: DataResourceNode | ValueNode;
        if (selectedOption.type === "value") {
          referenceNode = $createValueNode(
            selectedOption.id,
            selectedOption.name,
            selectedOption.icon,
          );
        } else {
          referenceNode = $createDataResourceNode(
            selectedOption.id,
            selectedOption.name,
            selectedOption.icon,
          );
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

  const options = useMemo(() => {
    let options: ReferenceOption[] = [];

    if (dataResource) {
      if (dataResource.provider === "postgres") {
        options.push(
          new ReferenceOption(
            dataResource.id,
            dataResource.name,
            "data-resource",
            {
              icon: "postgres-icon",
              keywords: ["postgres", "data-resource", dataResource.name],
              onSelect: (queryString) => {
                console.log(queryString);
              },
            },
          ),
        );

        (dataResource.metadata as DataResourceMetadata).tables.forEach(
          (table) => {
            table.columns.forEach((column) =>
              options.push(
                new ReferenceOption(
                  `${table.name}.${column}`,
                  `${table.name}.${column}`,
                  "value",
                  {
                    icon: "column-icon",
                    keywords: ["column", column],
                    onSelect: (queryString) => {
                      console.log(queryString);
                    },
                  },
                ),
              ),
            );
            options.push(
              new ReferenceOption(table.name, table.name, "value", {
                icon: "table-icon",
                keywords: ["table", table.name],
                onSelect: (queryString) => {
                  console.log(queryString);
                },
              }),
            );
          },
        );
      }
    } else if (dataResources && !dataResourceId) {
      options = dataResources.map(
        (dataResource) =>
          new ReferenceOption(
            dataResource.id,
            dataResource.name,
            "data-resource",
            {
              icon: "postgres-icon",
              keywords: ["postgres", "data-resource", dataResource.name],
              onSelect: (queryString) => {
                console.log(queryString);
              },
            },
          ),
      );
    }
    return options;
  }, [dataResource, dataResourceId, dataResources]);

  return (
    <LexicalTypeaheadMenuPlugin<ReferenceOption>
      onQueryChange={onQueryChange}
      onSelectOption={onSelectOption}
      triggerFn={checkForTriggerMatch}
      options={options}
      menuRenderFn={(
        anchorElement,
        { selectedIndex, selectOptionAndCleanUp, setHighlightedIndex },
      ) =>
        anchorElement && options.length ? (
          <div className="absolute left-3 top-8 flex max-h-40 min-w-48 flex-col overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            {options.map((option, i: number) => (
              <div
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
                  setHighlightedIndex(i - 1);
                }}
                onKeyDown={() => {
                  setHighlightedIndex(i + 1);
                }}
                onMouseEnter={() => {
                  setHighlightedIndex(i);
                }}
                key={option.key}
              >
                {option.icon === "postgres-icon" ? (
                  <PostgresIcon className="size-3 text-primary" />
                ) : option.icon === "value-icon" ? (
                  <VariableIcon className="size-3 text-primary" />
                ) : (
                  <DatabaseIcon className="size-3 text-primary" />
                )}
                <span className="text">{option.name}</span>
              </div>
            ))}
          </div>
        ) : null
      }
    />
  );
}
