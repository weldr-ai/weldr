import type { db } from ".";

export type Tx = typeof db.transaction extends (
  // biome-ignore lint/suspicious/noExplicitAny: reason
  callback: (tx: infer T) => any,
  // biome-ignore lint/suspicious/noExplicitAny: reason
) => any
  ? T
  : never;

export type Db = typeof db;
