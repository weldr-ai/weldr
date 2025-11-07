import { Logger } from "@weldr/shared/logger";
import { getBranchDir } from "@weldr/shared/state";
import type { Integration, IntegrationKey } from "@weldr/shared/types";

import type { WorkflowContext } from "@/workflow/context";
import type { ExtractOptionsForKey, IntegrationDefinition } from "../types";
import { combineResults } from "./combine-results";
import { seedDeclarationTemplates } from "./declaration-templates-utils";
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
      try {
        const project = context.get("project");
        const branch = context.get("branch");
        const branchDir = getBranchDir(project.id, branch.id);

        const options = integration?.options as
          | ExtractOptionsForKey<K>
          | undefined;

        const packages = (await props.packages?.(context, options)) ?? [];
        const scripts = (await props.scripts?.(context, options)) ?? [];

        const results = await Promise.all([
          updatePackageJsonScripts(scripts, branchDir),
          installPackages(packages, branchDir),
          seedDeclarationTemplates({
            integration,
            context,
          }),
          props.postInstall?.({ context, integration }),
        ]);

        context.set("project", {
          ...project,
          integrationCategories: new Set([
            ...project.integrationCategories,
            props.category,
          ]),
        });

        return combineResults(results.filter((r) => r !== undefined));
      } catch (error: unknown) {
        Logger.error("Failed to run postInstall hook", {
          error,
        });

        return {
          success: false,
          message: "Failed to run postInstall hook",
        };
      }
    },
  } as unknown as IntegrationDefinition<K>;
}
