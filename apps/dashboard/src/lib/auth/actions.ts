"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { signIn } from "@integramind/auth";

const userSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export async function signInWithMagicLink(
  _prevState: { errors: z.ZodIssue[] },
  formData: FormData,
) {
  try {
    const validation = await userSchema.safeParseAsync({
      email: formData.get("email"),
    });

    if (validation.success) {
      await signIn("resend", {
        email: validation.data.email,
        redirect: true,
        redirectTo: "/",
      });
      redirect(`/auth/email-sent-confirmation?email=${validation.data.email}`);
    } else {
      return { errors: validation.error.issues };
    }
  } catch (error) {
    return { errors: [] };
  }
}
