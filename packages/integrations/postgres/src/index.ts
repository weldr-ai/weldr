import pg from "pg";

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
    dataType: string;
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

export async function auth({ auth }: { auth: PostgresAuth }) {
  try {
    const client = await pgClient(auth);
    await client.end();
  } catch (e) {
    return {
      valid: false,
      error: JSON.stringify(e),
    };
  }
  return {
    valid: true,
  };
}

export async function executeQuery({
  auth,
  query,
  values = [],
}: {
  auth: PostgresAuth;
  query: string;
  values: unknown[];
}) {
  const client = await pgClient(auth);
  return new Promise((resolve, reject) => {
    client.query(
      query,
      values,
      (error: unknown, results: { rows: unknown }) => {
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

export async function run(
  actionName: string,
  context: Record<string, unknown>,
) {
  switch (actionName) {
    case "executeQuery":
      return executeQuery({
        ...context,
      } as { auth: PostgresAuth; query: string; values: unknown[] });
    default:
      throw new Error(`Action ${actionName} not found`);
  }
}

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
        json_agg(json_build_object('name', c.column_name, 'dataType', c.data_type)) AS columns
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
              dataType: string;
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

export const actions = [
  `function executeQuery({
    auth,
    query,
    values = [],
  }: {
    auth: PostgresAuth;
    query: string;
    values: unknown[];
  }): Promise<INSERT_RESULT_TYPE_HERE>`,
];

export const type = "database";
