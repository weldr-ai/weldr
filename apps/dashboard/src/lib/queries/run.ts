"use server";

import { db, eq } from "@integramind/db";
import { jobs } from "@integramind/db/schema";

export async function getJobById({ id }: { id: string }) {
  const result = await db.select().from(jobs).where(eq(jobs.id, id));
  return result[0];
}
