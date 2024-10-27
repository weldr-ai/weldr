```typescript
import dotenv from "dotenv";
import type { QueryResult, QueryResultRow } from "pg";
import { Pool } from "pg";

dotenv.config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: Number(process.env.DB_PORT),
});

export function query<T extends QueryResultRow>(
  text: string,
  params: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}
```
