import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const serverEnv = createEnv({
  server: {
    RESEND_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
  },
});
