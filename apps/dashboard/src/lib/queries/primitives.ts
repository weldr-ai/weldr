"use server";

import { db, sql } from "@integramind/db";
import { primitives } from "@integramind/db/schema";

export async function createPrimitive({
  id,
  type,
  name,
  flowId,
}: {
  id: string;
  type: "function" | "conditional-branch" | "loop" | "response";
  name: string;
  flowId: string;
}) {
  const result = await db.insert(primitives).values({
    id,
    type,
    name,
    flowId,
    metadata: sql`${{
      type,
    }}`,
  });
  return result;
}
