import type { WorkflowContext } from "@/workflow/context";

import type { Integration, IntegrationKey } from "@weldr/shared/types";
import type { ExtractOptionsForKey, IntegrationDefinition } from "../types";
import { combineResults } from "./combine-results";
import { installPackages, updatePackageJsonScripts } from "./packages";

export function defineIntegration<K extends IntegrationKey>(
  props: IntegrationDefinition<K>,
): IntegrationDefinition<K> {
  return {
    ...props,
    postInstall: async ({
      context,
      integration,
    }: {
      context: WorkflowContext;
      integration: Integration;
    }) => {
      const options = integration?.options as
        | ExtractOptionsForKey<K>
        | undefined;

      const packages = (await props.packages?.(context, options)) ?? [];
      const scripts = (await props.scripts?.(context, options)) ?? [];

      const results = await Promise.all([
        updatePackageJsonScripts(scripts),
        installPackages(packages),
        props.postInstall?.({ context, integration }),
      ]);

      const project = context.get("project");

      context.set("project", {
        ...project,
        integrationCategories: new Set([
          ...project.integrationCategories,
          props.category,
        ]),
      });

      return combineResults(results.filter((r) => r !== undefined));
    },
  } as unknown as IntegrationDefinition<K>;
}
