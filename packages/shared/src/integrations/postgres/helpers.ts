import "server-only";

import { Pool } from "pg";
import type { DataType } from "../../types";
import type { DatabaseStructure, DatabaseTable, DbConfig } from "./index";

// @ts-ignore
function pgTypeToJsonSchemaType(pgType: string): DataType {
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

export async function testConnection(config: DbConfig): Promise<boolean> {
  console.log(config);

  console.log(
    config.host,
    config.port,
    config.database,
    config.user,
    config.password,
  );

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

export async function getDatabaseStructure(
  config: DbConfig,
): Promise<DatabaseStructure> {
  const pool = new Pool({
    host: config.host,
    port: Number(config.port),
    database: config.database,
    user: config.user,
    password: config.password,
    connectionTimeoutMillis: 5000,
  });

  const tables: DatabaseTable[] = [];

  try {
    await pool.connect();

    // Get all tables in public schema
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE';
    `;

    const tablesResult = await pool.query(tablesQuery);

    for (const tableRow of tablesResult.rows) {
      // Get columns and primary key info for tables in public schema
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
          WHERE tc.table_schema = 'public'
          AND tc.table_name = $1
          AND tc.constraint_type = 'PRIMARY KEY'
        ) pk ON c.column_name = pk.column_name
        WHERE c.table_schema = 'public'
        AND c.table_name = $1
        ORDER BY c.ordinal_position;
      `;

      const columns = await pool.query(columnsQuery, [tableRow.table_name]);

      // Get foreign key relationships for tables in public schema
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
        AND tc.table_schema = 'public'
        AND tc.table_name = $1;
      `;

      const relationships = await pool.query(relationshipsQuery, [
        tableRow.table_name,
      ]);

      tables.push({
        name: tableRow.table_name,
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
  } catch (error) {
    console.error("Error getting database structure:", error);
  }

  return tables;
}
