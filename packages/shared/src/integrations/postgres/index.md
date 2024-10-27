# PostgreSQL

A PostgreSQL integration that connects your workspace to your PostgreSQL database, allowing you to perform any database operations.

## Environment Variables

- `DB_USER`: The username to connect to the database
- `DB_PASSWORD`: The password to connect to the database
- `DB_HOST`: The host to connect to the database
- `DB_PORT`: The port to connect to the database
- `DB_NAME`: The name of the database

## Dependencies

- `pg`: A PostgreSQL client for Node.js
- `@types/pg`: TypeScript definitions for `pg`
- `dotenv`: A module that loads environment variables from a `.env` file into `process.env`
