"use server";

import type { z } from "zod";

import { db, eq } from "@integramind/db";
import { insertWaitlistSchema, waitlist } from "@integramind/db/schema";

type FormState =
  | {
      status: "success";
      payload: {
        id: string;
      };
    }
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

export async function joinWaitlist(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData) as Record<string, string>;
  const validation = insertWaitlistSchema.safeParse(data);

  const fields: Record<string, string> = Object.entries(data).reduce(
    (acc: Record<string, string>, [key, value]) => {
      acc[key] = value;
      return acc;
    },
    {},
  );

  try {
    if (validation.success) {
      const doesExist = await db.query.waitlist.findFirst({
        where: eq(waitlist.email, validation.data.email),
      });

      if (doesExist) {
        return { status: "success", payload: { id: doesExist.id } };
      }

      const result = (
        await db
          .insert(waitlist)
          .values({
            ...validation.data,
          })
          .onConflictDoNothing()
          .returning({ id: waitlist.id })
      )[0];

      if (result) {
        return { status: "success", payload: { id: result.id } };
      } else {
        return { status: "error", fields };
      }
    } else {
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
  } catch (error) {
    return { status: "error", fields };
  }
}
