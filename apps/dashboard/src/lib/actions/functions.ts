"use server";

import { db } from "@integramind/db";
import { functions } from "@integramind/db/schema";

export async function createFunction({
  id,
  name,
  description,
}: {
  id: string;
  name: string;
  description?: string;
}): Promise<string | undefined> {
  const result = (
    await db
      .insert(functions)
      .values({
        id,
        name,
        description,
      })
      .returning({ id: functions.id })
  )[0]?.id;
  return result;
}
