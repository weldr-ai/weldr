import { architect } from "./architect";
import { authenticationCoder } from "./authentication-coder";
import { enricher } from "./enricher";
import { generalCoder } from "./general-coder";
import { requirementsGatherer } from "./requirements-gatherer";

export const prompts = {
  authenticationCoder,
  generalCoder,
  requirementsGatherer,
  architect,
  enricher,
};
