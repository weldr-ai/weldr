import type { TextNode } from "lexical";
import { useCallback, useMemo, useState } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { Database, Variable } from "lucide-react";

import { cn } from "@integramind/ui/utils";

import type { ResourceNode } from "~/components/editor/nodes/resource-node";
import type { ValueNode } from "~/components/editor/nodes/value-node";
import { $createResourceNode } from "~/components/editor/nodes/resource-node";
import { $createValueNode } from "~/components/editor/nodes/value-node";

class ReferenceOption extends MenuOption {
  // The id of the reference
  id: string;
  // What shows up in the editor
  name: string;
  // Reference type
  type: "value" | "resource";
  // Icon for display
  icon?: JSX.Element;
  // For extra searching.
  keywords: string[];
  // TBD
  keyboardShortcut?: string;
  // What happens when you select this option?
  onSelect: (queryString: string) => void;

  constructor(
    id: string,
    name: string,
    type: "value" | "resource",
    options: {
      icon?: JSX.Element;
      keywords?: string[];
      keyboardShortcut?: string;
      onSelect: (queryString: string) => void;
    },
  ) {
    super(name);
    this.id = id;
    this.name = name;
    this.type = type;
    this.keywords = options.keywords ?? [];
    this.icon = options.icon;
    this.keyboardShortcut = options.keyboardShortcut;
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
        let referenceNode: ResourceNode | ValueNode;
        if (selectedOption.type === "value") {
          referenceNode = $createValueNode(
            selectedOption.id,
            selectedOption.name,
          );
        } else {
          referenceNode = $createResourceNode(
            selectedOption.id,
            selectedOption.name,
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
      new ReferenceOption(crypto.randomUUID(), "DB1", "resource", {
        keywords: ["resource"],
        icon: <Database className="size-3 text-primary" />,
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
      new ReferenceOption(crypto.randomUUID(), "DB2", "resource", {
        keywords: ["resource"],
        icon: <Database className="size-3 text-primary" />,
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
      new ReferenceOption(crypto.randomUUID(), "age", "value", {
        keywords: ["input"],
        icon: <Variable className="size-3 text-primary" />,
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
      new ReferenceOption(crypto.randomUUID(), "name", "value", {
        keywords: ["input"],
        icon: <Variable className="size-3 text-primary" />,
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
                {option.icon}
                <span className="text">{option.name}</span>
              </div>
            ))}
          </div>
        ) : null
      }
    />
  );
}
