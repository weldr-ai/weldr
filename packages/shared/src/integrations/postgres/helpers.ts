import type { DataType } from "../../types";

import { Pool, type PoolClient } from "pg";

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export async function testConnection(config: DbConfig): Promise<boolean> {
  console.log(config);

  const pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    connectionTimeoutMillis: 5000,
  });

  try {
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.error("Database connection test failed:", error);
    try {
      await pool.end();
    } catch (endError) {
      console.error("Error ending pool:", endError);
    }
    return false;
  }
}

type Database = Table[];

interface Table {
  tableName: string;
  columns: Column[];
  relationships: Relationship[];
}

interface Column {
  name: string;
  dataType: string;
  isNullable: boolean;
  isPrimaryKey: boolean;
}

interface Relationship {
  columnName: string;
  referencedTable: string;
  referencedColumn: string;
}

export async function getDatabaseStructure(pool: Pool): Promise<Database> {
  let client: PoolClient | null = null;

  try {
    client = await pool.connect();

    // Get all tables
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `;

    const tables = await client.query(tablesQuery);
    const table: Table[] = [];

    for (const table of tables.rows) {
      // Get columns and primary key info
      const columnsQuery = `
        SELECT
          c.column_name,
          c.data_type,
          c.is_nullable = 'YES' as is_nullable,
          pk.constraint_type IS NOT NULL as is_primary_key
        FROM information_schema.columns c
        LEFT JOIN (
          SELECT ku.column_name, tc.constraint_type
          FROM information_schema.table_constraints tc
          JOIN information_schema.key_column_usage ku
          ON tc.constraint_name = ku.constraint_name
          WHERE tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_name = $1
        ORDER BY c.ordinal_position;
      `;

      const columns = await client.query(columnsQuery, [table.table_name]);

      // Get foreign key relationships
      const relationshipsQuery = `
        SELECT
          kcu.column_name,
          ccu.table_name AS referenced_table,
          ccu.column_name AS referenced_column
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = $1;
      `;

      const relationships = await client.query(relationshipsQuery, [
        table.table_name,
      ]);

      table.push({
        tableName: table.table_name,
        columns: columns.rows.map((col) => ({
          name: col.column_name,
          dataType: col.data_type,
          isNullable: col.is_nullable,
          isPrimaryKey: col.is_primary_key,
        })),
        relationships: relationships.rows.map((rel) => ({
          columnName: rel.column_name,
          referencedTable: rel.referenced_table,
          referencedColumn: rel.referenced_column,
        })),
      });
    }

    return table;
  } catch (error) {
    console.error("Error getting database structure:", error);
    throw error;
  } finally {
    if (client) {
      client.release();
    }
  }
}

export function pgTypeToJsonSchemaType(pgType: string): DataType {
  let normalizedPgType = pgType.trim().toLowerCase();

  if (normalizedPgType.endsWith("[]")) {
    return "array";
  }

  normalizedPgType = pgType.replace(/\(.*\)/, "").trim();

  const typeMapping: { [key: string]: DataType } = {
    smallint: "integer",
    integer: "integer",
    int: "integer",
    bigint: "integer",
    serial: "integer",
    bigserial: "integer",
    decimal: "number",
    numeric: "number",
    real: "number",
    "double precision": "number",
    boolean: "boolean",
    bool: "boolean",
    "character varying": "string",
    varchar: "string",
    character: "string",
    char: "string",
    text: "string",
    date: "string",
    time: "string",
    "time without time zone": "string",
    timestamp: "string",
    "timestamp without time zone": "string",
    "timestamp with time zone": "string",
    json: "object",
    jsonb: "object",
    uuid: "string",
    bytea: "string",
    inet: "string",
    cidr: "string",
    macaddr: "string",
    xml: "string",
    tsvector: "string",
    tsquery: "string",
    hstore: "object",
  };

  return typeMapping[normalizedPgType] ?? "null";
}
