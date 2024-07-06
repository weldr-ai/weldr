"use server";

import { db, eq } from "@integramind/db";
import { jobs } from "@integramind/db/schema";

import type { Job } from "~/types";

export async function getJobById({
  id,
}: {
  id: string;
}): Promise<Job | undefined> {
  const result = await db.select().from(jobs).where(eq(jobs.id, id));
  return result[0] as Job | undefined;
}
