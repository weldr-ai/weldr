#!/usr/bin/env tsx

import type { IntegrationKey } from "@weldr/shared/types";
import { integrationRegistry } from "./registry";

import "./backend";
import "./frontend";

async function main() {
  const integrationKey = process.argv[2] as IntegrationKey | undefined;

  if (integrationKey) {
    console.log(`Generating specs for integration: ${integrationKey}`);
    await integrationRegistry.generateSpecs(integrationKey);
  } else {
    console.log("Generating specs for all integrations");
    await integrationRegistry.generateSpecs();
  }
}

main().catch(console.error);
