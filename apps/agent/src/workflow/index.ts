import { createWorkflow } from "./engine";
import { codeStep } from "./steps/code";
import { deployStep } from "./steps/deploy";
import { enrichStep } from "./steps/enrich";
import { planStep } from "./steps/plan";
import { screenshotStep } from "./steps/screenshot";

const isDev = process.env.NODE_ENV === "development";

export const workflow = createWorkflow({
  retryConfig: {
    attempts: 3,
    delay: 1000,
  },
})
  .step(planStep)
  .suspend(({ context }) => !context.get("version").progress)
  .step(codeStep)
  .parallel(isDev ? [] : [enrichStep, deployStep, screenshotStep]);
