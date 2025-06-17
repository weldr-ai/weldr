import { createWorkflow } from "@mastra/core";
import { z } from "zod";
import { codeStep } from "./steps/code";
import { deployStep } from "./steps/deploy";
import { enrichStep } from "./steps/enrich";
import { guardStep } from "./steps/guard";
import { planStep } from "./steps/plan";
import { screenshotStep } from "./steps/screenshot";

export const codingWorkflow = createWorkflow({
  id: "coding-workflow",
  description: "A workflow for coding",
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
  inputSchema: z.void(),
  outputSchema: z.void(),
  steps: [planStep, codeStep, enrichStep, deployStep, screenshotStep],
})
  .then(planStep)
  .then(guardStep)
  .then(codeStep)
  .parallel([enrichStep, deployStep, screenshotStep])
  .commit();
