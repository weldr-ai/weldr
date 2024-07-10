"use server";

import type { z } from "zod";
import { redirect } from "next/navigation";

import { signOut as nextAuthSignOut, signIn } from "@integramind/auth";
import { signInWithMagicLinkSchema } from "@integramind/auth/validators";

type FormState =
  | {
      status: "validationError";
      fields: Record<string, string>;
      errors: Record<string, string>;
    }
  | {
      status: "error";
      fields: Record<string, string>;
    }
  | undefined;

export async function signInWithMagicLink(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const validation = signInWithMagicLinkSchema.safeParse(data);

  // TODO: move these functions to a common lib file
  const fields: Record<string, string> = Object.entries(data).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {} as Record<string, string>,
  );

  if (validation.success) {
    await signIn("resend", {
      email: validation.data.email,
      redirect: false,
    });
    redirect(`/auth/verify-email?email=${validation.data.email}`);
  } else {
    // TODO: move these functions to a common lib file
    const errors = validation.error.issues.reduce(
      (acc: Record<string, string>, issue: z.ZodIssue) => {
        const key = issue.path[0] as string;
        acc[key] = issue.message;
        return acc;
      },
      {},
    );
    return {
      status: "validationError",
      fields,
      errors,
    };
  }
}

export async function signOut() {
  await nextAuthSignOut({
    redirectTo: "/auth/sign-in",
  });
}
