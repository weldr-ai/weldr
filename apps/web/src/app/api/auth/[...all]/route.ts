import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@weldr/auth";

export const { GET, POST } = toNextJsHandler(auth);
