import type { TextNode } from "lexical";
import { useCallback, useMemo, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { DatabaseIcon, VariableIcon } from "lucide-react";

import { cn } from "@integramind/ui/utils";

import type { DataResourceNode } from "~/components/editor/nodes/data-resource-node";
import type { ValueNode } from "~/components/editor/nodes/value-node";
import { $createDataResourceNode } from "~/components/editor/nodes/data-resource-node";
import { $createValueNode } from "~/components/editor/nodes/value-node";
import { PostgreSQLIcon } from "~/components/icons/postgresql-icon";

class ReferenceOption extends MenuOption {
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
  const [editor] = useLexicalComposerContext();
  const [_queryString, setQueryString] = useState<string | null>(null);

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
    return [
      new ReferenceOption(crypto.randomUUID(), "DB1", "data-resource", {
        keywords: ["postgreSQL"],
        icon: "postgresql-icon",
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
      new ReferenceOption(crypto.randomUUID(), "DB2", "data-resource", {
        keywords: ["data-resource"],
        icon: "database-icon",
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
      new ReferenceOption(crypto.randomUUID(), "age", "value", {
        keywords: ["input"],
        icon: "value-icon",
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
      new ReferenceOption(crypto.randomUUID(), "name", "value", {
        keywords: ["input"],
        icon: "value-icon",
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
    ];
  }, []);

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
          <div className="absolute left-3 top-8 z-50 min-w-48 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
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
                onKeyUp={() => setHighlightedIndex(i - 1)}
                onKeyDown={() => setHighlightedIndex(i + 1)}
                onMouseEnter={() => {
                  setHighlightedIndex(i);
                }}
                key={option.key}
              >
                {option.icon === "postgresql-icon" ? (
                  <PostgreSQLIcon className="size-3 text-primary" />
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
