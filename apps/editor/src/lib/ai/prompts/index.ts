import { coder } from "./coder";
import { authenticationConventions } from "./conventions/authentication-rules";
import { baseConventions } from "./conventions/base-rules";
import { manager } from "./manager";

export const prompts = {
  coder,
  manager,
  authenticationConventions,
  baseConventions,
};
