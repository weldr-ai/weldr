import { runCommand } from "@/ai/utils/commands";
import type { IntegrationKey } from "@weldr/shared/types";
import type { IntegrationDefinition } from "./types";

class IntegrationRegistry {
  private integrations = new Map<IntegrationKey, IntegrationDefinition>();

  register(integration: IntegrationDefinition): void {
    this.integrations.set(integration.key, integration);
  }

  get(key: IntegrationKey): IntegrationDefinition | undefined {
    return this.integrations.get(key);
  }

  getAll(): IntegrationDefinition[] {
    return Array.from(this.integrations.values());
  }

  has(key: IntegrationKey): boolean {
    return this.integrations.has(key);
  }

  list(): IntegrationKey[] {
    return Array.from(this.integrations.keys());
  }

  async generateSpecs(integrationKey?: IntegrationKey): Promise<void> {
    const integrations = integrationKey
      ? [this.get(integrationKey)].filter(
          (integration): integration is IntegrationDefinition =>
            integration !== undefined,
        )
      : this.getAll();

    if (integrationKey && integrations.length === 0) {
      console.error(`Integration '${integrationKey}' not found`);
      return;
    }

    for (const integration of integrations) {
      const dataDir = `${integration.key}/data`;

      // Check if data directory exists
      const checkResult = await runCommand("test", ["-d", dataDir], {
        cwd: "apps/agent/src/integrations",
      });
      if (!checkResult.success) {
        console.log(`No data directory found for ${integration.key}`);
        continue;
      }

      // Recursively find all files in the data directory
      const findResult = await runCommand("find", [dataDir, "-type", "f"], {
        cwd: "apps/agent/src/integrations",
      });
      if (!findResult.success) {
        console.error(`Failed to list files for ${integration.key}`);
        continue;
      }

      const files = findResult.stdout.trim().split("\n").filter(Boolean);
      const specs = files.map((filePath) => {
        const relativePath = filePath.replace(`${dataDir}/`, "");
        let type: string;

        if (filePath.endsWith(".txt")) {
          type = "llm_instruction";
        } else if (filePath.endsWith(".hbs")) {
          type = "handlebars";
        } else {
          type = "copy";
        }

        return {
          type,
          path: relativePath,
        };
      });

      // Write the JSON spec file
      const specContent = JSON.stringify(specs, null, 2);
      const specPath = `${integration.key}/specs.json`;

      await runCommand("sh", ["-c", `echo '${specContent}' > "${specPath}"`], {
        cwd: "apps/agent/src/integrations",
      });
      console.log(`Generated spec for ${integration.key} at ${specPath}`);
    }
  }
}

export const integrationRegistry = new IntegrationRegistry();
