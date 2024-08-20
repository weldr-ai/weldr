"use server";

import { redirect } from "next/navigation";
import type { z } from "zod";

import { signOut as nextAuthSignOut, signIn } from "@integramind/auth";
import { signInWithMagicLinkSchema } from "@integramind/auth/validators";
import type { BaseFormState } from "@integramind/shared/types";

type FormFields = z.infer<typeof signInWithMagicLinkSchema>;

type FormState = BaseFormState<FormFields>;

export async function signInWithMagicLink(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const validation = signInWithMagicLinkSchema.safeParse(data);

  const fields = Object.entries(data).reduce(
    (acc: FormFields, [key, value]) => {
      acc[key as keyof FormFields] = value;
      return acc;
    },
    {} as FormFields,
  );

  if (validation.success) {
    await signIn("resend", {
      email: validation.data.email,
      redirect: false,
    });
    redirect(`/auth/verify-email?email=${validation.data.email}`);
  } else {
    const errors = validation.error.issues.reduce(
      (acc: FormFields, issue: z.ZodIssue) => {
        const key = issue.path[0] as keyof FormFields;
        acc[key] = issue.message;
        return acc;
      },
      {} as FormFields,
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
