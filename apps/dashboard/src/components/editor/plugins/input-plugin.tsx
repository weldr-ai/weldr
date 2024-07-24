import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  LexicalTypeaheadMenuPlugin,
  MenuOption,
  useBasicTypeaheadTriggerMatch,
} from "@lexical/react/LexicalTypeaheadMenuPlugin";
import { createId } from "@paralleldrive/cuid2";
import type { TextNode } from "lexical";
import { HashIcon, TextIcon } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { cn } from "@integramind/ui/utils";

import { $createInputNode } from "~/components/editor/nodes/input-node";
import { api } from "~/lib/trpc/react";

export class InputOption extends MenuOption {
  // The id of the reference
  id: string;
  // What shows up in the editor
  name: string;
  // Test value
  testValue?: string | number | null;
  // Input type
  inputType: "text" | "number";
  // Icon for display
  icon: string;
  // For extra searching.
  keywords: string[];
  // What happens when you select this option?
  onSelect: (queryString: string) => void;

  constructor(
    id: string,
    name: string,
    inputType: "text" | "number",
    options: {
      icon: string;
      keywords?: string[];
      onSelect: (queryString: string) => void;
    },
    testValue?: string | number | null,
  ) {
    super(name);
    this.id = id;
    this.name = name;
    this.testValue = testValue;
    this.inputType = inputType;
    this.icon = options.icon;
    this.keywords = options.keywords ?? [];
    this.onSelect = options.onSelect.bind(this);
  }
}

export function InputsPlugin({ id }: { id: string }) {
  const [editor] = useLexicalComposerContext();
  const [_queryString, setQueryString] = useState<string | null>(null);

  const addInput = api.primitives.addInput.useMutation();

  const checkForTriggerMatch = useBasicTypeaheadTriggerMatch("/", {
    minLength: 0,
  });

  const onQueryChange = useCallback((matchingString: string | null) => {
    setQueryString(matchingString);
  }, []);

  const onSelectOption = useCallback(
    (
      selectedOption: InputOption,
      nodeToReplace: TextNode | null,
      closeMenu: () => void,
    ) => {
      const inputId = createId();
      editor.update(() => {
        const inputNode = $createInputNode(
          selectedOption.id,
          inputId,
          selectedOption.name,
          selectedOption.inputType,
          selectedOption.testValue ?? null,
        );
        if (nodeToReplace) {
          nodeToReplace.replace(inputNode);
        }
        inputNode.decorate();
        closeMenu();
      });
      addInput.mutate({
        id: selectedOption.id,
        inputId,
        name: selectedOption.name,
        type: selectedOption.inputType,
      });
    },
    [editor, addInput],
  );

  const options = useMemo(() => {
    return [
      new InputOption(id, "Text", "text", {
        icon: "text-icon",
        keywords: ["text"],
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
      new InputOption(id, "Number", "number", {
        icon: "number-icon",
        keywords: ["name"],
        onSelect: (queryString) => {
          console.log(queryString);
        },
      }),
    ];
  }, [id]);

  return (
    <LexicalTypeaheadMenuPlugin<InputOption>
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
                {option.icon === "text-icon" ? (
                  <TextIcon className="size-3 text-primary" />
                ) : option.icon === "number-icon" ? (
                  <HashIcon className="size-3 text-primary" />
                ) : (
                  <></>
                )}
                <span className="text">{option.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="absolute left-3 top-8 flex min-w-48 rounded-md border bg-muted p-2 text-xs">
            No references found.
          </div>
        )
      }
    />
  );
}
