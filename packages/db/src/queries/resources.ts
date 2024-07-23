import pg from "pg";

import { db, eq } from "..";
import { resources } from "../schema";
import type { Resource } from "../types";

const { Client } = pg;

interface PostgresAuth {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export interface Table {
  name: string;
  columns: {
    name: string;
    type: string;
  }[];
}

export const pgClient = async (
  auth: PostgresAuth,
  queryTimeout = 30000,
  applicationName: string | undefined = undefined,
  connectionTimeoutMillis = 30000,
) => {
  const { host, user, database, password, port } = auth;
  const client = new Client({
    host,
    port: Number(port),
    user,
    password,
    database,
    query_timeout: Number(queryTimeout),
    statement_timeout: Number(queryTimeout),
    application_name: applicationName,
    connectionTimeoutMillis: Number(connectionTimeoutMillis),
  });
  await client.connect();

  return client;
};

export async function getInfo({
  auth,
}: {
  auth: PostgresAuth;
}): Promise<Table[]> {
  const client = await pgClient(auth);
  return new Promise((resolve, reject) => {
    client.query(
      `SELECT
        t.table_name AS name,
        json_agg(json_build_object('name', c.column_name, 'type', c.data_type)) AS columns
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c
      ON t.table_name = c.table_name
      WHERE t.table_schema = 'public'
      GROUP BY t.table_name;`,
      [],
      (
        error: unknown,
        results: {
          rows: {
            name: string;
            columns: {
              name: string;
              type: string;
            }[];
          }[];
        },
      ) => {
        if (error) {
          void client.end();
          return reject(error);
        }
        resolve(results.rows);
        void client.end();
      },
    );
  });
}

export async function getResourceById({ id }: { id: string }): Promise<
  | (Resource & {
      metadata: {
        tables: Table[];
      };
    })
  | undefined
> {
  const result = await db.select().from(resources).where(eq(resources.id, id));

  if (!result[0]) {
    return;
  }

  if (result[0].provider === "postgres") {
    const auth = result[0].metadata;

    const tables = await getInfo({
      auth: {
        host: auth.host,
        port: auth.port,
        user: auth.user,
        password: auth.password,
        database: auth.database,
      },
    });

    return {
      ...result[0],
      metadata: {
        ...result[0].metadata,
        tables,
      },
    };
  }
}

export async function getResources({ workspaceId }: { workspaceId: string }) {
  const result = await db
    .select()
    .from(resources)
    .where(eq(resources.workspaceId, workspaceId));
  return result;
}
