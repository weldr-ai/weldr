"use server";

import { redirect } from "next/navigation";
import { Resend } from "resend";
import type { z } from "zod";

import { db, eq } from "@integramind/db";
import { insertWaitlistSchema, waitlist } from "@integramind/db/schema";

const resend = new Resend(process.env.RESEND_API_KEY ?? "");

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

  if (validation.success) {
    const doesExist = await db.query.waitlist.findFirst({
      where: eq(waitlist.email, validation.data.email),
    });

    if (doesExist) {
      redirect("/waitlist-confirmation");
    }

    const result = await db.transaction(async (tx) => {
      const result = await tx
        .insert(waitlist)
        .values({
          ...validation.data,
        })
        .returning({ id: waitlist.id });

      if (result) {
        await resend.emails.send({
          from: "IntegraMind <noreply@integramind.ai>",
          to: [validation.data.email],
          subject: "Thank you for your interest!",
          html: "<p>Hi,</p><p>Thank you for your interest! We will get in touch with you soon when we launch.</p><p>If you have any questions, please feel free to reach out to us at <a href='mailto:hey@integramind.ai'>hey@integramind.ai</a>.</p><p>Best regards, <br /> IntegraMind Team</p>",
        });
      } else {
        throw new Error("Failed to insert waitlist");
      }

      return result[0];
    });

    if (result) {
      redirect("/waitlist-confirmation");
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
}
