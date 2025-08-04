import { useMemo } from "react";
import type { z } from "zod";

import type { RouterOutputs } from "@weldr/api";
import type { referencePartSchema } from "@weldr/shared/validators/chats";

interface UseEditorReferencesOptions {
  latestVersion:
    | RouterOutputs["projects"]["byId"]["versions"][number]
    | undefined;
}

export function useEditorReferences({
  latestVersion,
}: UseEditorReferencesOptions) {
  const editorReferences = useMemo(() => {
    return (
      latestVersion?.declarations?.reduce(
        (acc: z.infer<typeof referencePartSchema>[], declaration) => {
          const specs = declaration.declaration.metadata?.specs;

          switch (specs?.type) {
            case "endpoint": {
              acc.push({
                type: "reference:endpoint",
                id: declaration.declaration.id,
                method: specs.method,
                path: specs.path,
              });
              break;
            }
            case "db-model": {
              acc.push({
                type: "reference:db-model",
                id: declaration.declaration.id,
                name: specs.name,
              });
              break;
            }
            case "page": {
              acc.push({
                type: "reference:page",
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
  }, [latestVersion?.declarations]);

  return editorReferences;
}
