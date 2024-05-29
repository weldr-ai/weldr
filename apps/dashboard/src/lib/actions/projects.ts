"use server";

import type { z } from "zod";

import { db, eq } from "@integramind/db";
import { insertProjectSchema, projects } from "@integramind/db/schema";

import type { Project } from "~/types";

interface FormFields {
  name?: string;
  description?: string;
}

type FormState =
  | {
      status: "success";
      payload: {
        id: string;
      };
    }
  | {
      status: "validationError";
      fields: FormFields;
      errors: FormFields;
    }
  | {
      status: "error";
      fields: FormFields;
    }
  | undefined;

export async function createProject(
  prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const data = Object.fromEntries(formData);
  const validation = insertProjectSchema.safeParse(data);

  const fields: FormFields = Object.keys(data).reduce(
    (acc: FormFields, key: string) => {
      const fieldName = key as "name" | "description";
      const data = acc[fieldName];
      if (data) {
        acc[fieldName] = data.toString();
      }
      return acc;
    },
    {},
  );

  try {
    if (validation.success) {
      const result = (
        await db
          .insert(projects)
          .values({
            ...validation.data,
          })
          .returning({ id: projects.id })
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

export async function getProjects(): Promise<Project[]> {
  const result = await db.select().from(projects);
  return result;
}

export async function deleteProjects({ id }: { id: string }) {
  await db.delete(projects).where(eq(projects.id, id));
}
