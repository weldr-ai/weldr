import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";

export async function getTables(connectionString: string): Promise<
  | {
      name: string;
      columns: string[];
    }[]
  | false
> {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    const db = drizzle(client);
    const query = sql<{ name: string; columns: string[] }>`
      SELECT
          t.table_name AS name,
          json_agg(c.column_name) AS columns
      FROM
          information_schema.tables t
      LEFT JOIN
          information_schema.columns c
      ON
          t.table_name = c.table_name
      WHERE
          t.table_schema = 'public'
      GROUP BY
          t.table_name
    `;
    const result = await db.execute(query);
    return result.rows as { name: string; columns: string[] }[];
  } catch (error) {
    return false;
  } finally {
    await client.end();
  }
}
