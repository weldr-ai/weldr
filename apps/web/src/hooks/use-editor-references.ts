import { useMemo } from "react";
import type { z } from "zod";

import type { RouterOutputs } from "@weldr/api";
import type { referencePartSchema } from "@weldr/shared/validators/chats";

interface UseEditorReferencesOptions {
  version: RouterOutputs["branches"]["byId"]["headVersion"];
}

export function useEditorReferences({ version }: UseEditorReferencesOptions) {
  const editorReferences = useMemo(() => {
    return (
      version?.declarations?.reduce(
        (acc: z.infer<typeof referencePartSchema>[], declaration) => {
          const specs = declaration.declaration.metadata?.specs;

          switch (specs?.type) {
            case "endpoint": {
              acc.push({
                type: "endpoint",
                id: declaration.declaration.id,
                method: specs.method,
                path: specs.path,
              });
              break;
            }
            case "db-model": {
              acc.push({
                type: "db-model",
                id: declaration.declaration.id,
                name: specs.name,
              });
              break;
            }
            case "page": {
              acc.push({
                type: "page",
                id: declaration.declaration.id,
                name: specs.name,
              });
              break;
            }
            default: {
              break;
            }
          }

          return acc;
        },
        [] as z.infer<typeof referencePartSchema>[],
      ) ?? []
    );
  }, [version?.declarations]);

  return editorReferences;
}
