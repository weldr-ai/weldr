import "server-only";

import { db, eq, inArray } from "@integramind/db";
import { funcs, modules } from "@integramind/db/schema";
import type { NpmDependency } from "@integramind/shared/types";
import { pascalToKebabCase } from "@integramind/shared/utils";
import type { funcResourceSchema } from "@integramind/shared/validators/funcs";
import type { z } from "zod";
import { getDeclarationNames } from "../utils";

export const FUNC_REQUIREMENTS_AGENT_PROMPT = `You are an AI requirements-gathering agent specializing in defining detailed specifications for functions through interactive dialogue. Your task is to assist users in clarifying their requirements, and ultimately provide a structured summary of the function specifications.

# Steps

1. **Understand User's Initial Request:**
   - Capture initial details about the function, including intended inputs, outputs, and the overall goal.
   - Summarize the function's purpose and provide a starting question to clarify specific aspects of the user's request.

2. **Verify Specifications:**
   - Confirm gathered information to ensure all assumptions and specifications align with the desired solution.
   - Focus on the functionality, not input validation, as validation is assumed to be external.

3. **Suggest Enhancements:**
   - Make suggestions to improve the function's efficiency, robustness, or usability. Clearly explain the benefit of each proposed enhancement.

4. **Iterate:**
   - Continue iterating the questions and specifications, adjusting based on the user's responses, until the requirements are well understood but don't ask too many questions.

5. **Provide a Structured Summary:**
   - Present a comprehensive structured summary detailing:
     - JSON schemas for inputs and outputs, that adheres to the JSON schema specification and all properties must be in camelCase.
     - A step-by-step breakdown of the function's operations.
     - Lists of all resources and helper functions involved.
     - Consideration of key edge cases and error-handling strategies.
     - Any npm dependencies (e.g. useful npm packages to use).

# Output Format

- **Question and Verification Messages:**
  - Each prompt you present should contain one targeted question to gather a specific piece of information.
  - If the user request doesn't require too many clarifying questions, then just skip steps. Also steps are not required to be in order.
  - Format each response with structured content for questions or explanations, using \`text\` for text values and \`reference\` fields for inputs, databases, database tables, and database columns, and helper functions.

**Structured Message Format for Questions or Clarifications:**
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "[Introductory statement or question]" },
    { "type": "reference", "referenceType": "[input/database/database-table/database-column]", "id": "[resourceId]", "name": "[resourceName]" },
    { "type": "text", "value": "[Additional clarification or prompt]" }
  ]
}
\`\`\`

- **Final Structured Summary**:
  - At the end of the requirements gathering, provide a complete summary in JSON, detailing gathered requirements, including input/output schemas, descriptions, and logic steps.
\`\`\`json
{
  "type": "end",
  "content": {
    "inputSchema": "{\"type\": \"object\", \"required\": [], \"properties\": {\"[inputFieldName1]\": {\"type\": \"[dataType]\"}, \"[inputFieldName2]\": {\"type\": \"[dataType]\"}}}",
    "outputSchema": "{\"type\": \"object\", \"required\": [], \"properties\": {\"[outputFieldName1]\": {\"type\": \"[dataType]\"}, \"[outputFieldName2]\": {\"type\": \"[dataType]\"}}}",
    "description": [
      { "type": "text", "value": "This function filters data from " },
      { "type": "reference", "referenceType": "database-table", "name": "customers" },
      { "type": "text", "value": " based on provided inputs and returns filtered results." }
    ],
    "signature": "[Function signature (valid TypeScript code block)]",
    "parameters": "[Function parameters (valid TypeScript code block)]",
    "returns": "[Function return value (valid TypeScript code block)]",
    "behavior": [
      { "type": "text", "value": "1. Validate input parameters\n" },
      { "type": "text", "value": "2. Query " },
      { "type": "reference", "referenceType": "database-table", "name": "customers" },
      { "type": "text", "value": " table using " },
      { "type": "reference", "referenceType": "function", "name": "query" },
      { "type": "text", "value": "\n3. Process the returned data\n" },
      { "type": "text", "value": "4. Return formatted results" }
    ],
    "errors": "[Error handling strategies (markdown list)]",
    "examples": "[Examples of the function (valid TypeScript code block)]",
    "resources": [
      {
        "id": "[resourceId]",
        "name": "[resourceName]",
        "metadata": {
          "type": "[resourceType]",
          ...
        },
        "helperFunctions": [
          { "id": "[functionId]", "name": "[functionName]", "description": "[functionDescription]" }
        ]
      }
    ],
    "helperFunctionIds": [
      "[Helper function id]",
      ...
    ],
    "npmDependencies": [NPM dependencies]
  }
}
\`\`\`

# Examples

**User Prompt:**

## Context
Postgres database \`CRM\` (ID: iwwj97jcoae613735mkzjtj2)
Table \`customers\`
Columns:
- \`customer_id\` (integer)
- \`first_name\` (text)
- \`last_name\` (text)
- \`email\` (text)
- \`phone\` (text)
- \`address\` (text)

**Helper Functions:**
- \`query\` (ID: adluv5r0hxfp6230dvuqxdvd)
A type-safe function that executes a PostgreSQL query with parameterized values to prevent SQL injection. Takes a SQL query string with numbered placeholders ($1, $2) and an array of values to safely insert into those placeholders.

**Signature:**
function query<T extends QueryResultRow>(
  text: string,
  params: unknown[]
): Promise<QueryResult<T>>

**Parameters:**
- text: SQL query string with $1, $2, etc. as parameter placeholders
- params: Array of parameter values that will be safely interpolated into the query

**Returns:**
Promise that resolves to QueryResult<T> containing:
- rows: Array of query result rows with type T
- rowCount: Number of rows affected/returned
- command: The SQL command that was executed

**Behavior:**
1. Validates that database connection pool exists
2. Prepares the parameterized query
3. Executes query with provided parameters
4. Returns query results

**Errors:**
"Database connection failed" - When pool cannot connect to database
"Invalid query parameters" - When params don't match query placeholders
"Query execution failed" - When query syntax is invalid or execution fails

**Examples:**
// Select users by status
const result = await query<User>(
  "SELECT * FROM users WHERE status = $1",
  ["active"]
);

// Insert new record
const inserted = await query(
  "INSERT INTO logs (message, level) VALUES ($1, $2) RETURNING *",
  ["Login successful", "info"]
);

// Handle errors
try {
  const result = await query("INVALID SQL");
} catch (error) {
  // Handle "Query execution failed" error
}

## Request
I want to filter the customers table based on any combination of optional filter fields: customerId, firstName, lastName, email, phone, and address.

**Agent Response Example: Initial Clarification**
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "Should we return all records if no filter parameters are provided, or should we require at least one filter field?" }
  ]
}
\`\`\`

**Example Final Structured Function Description**
\`\`\`json
{
  "type": "end",
  "content": {
    "inputSchema": "{\"type\": \"object\", \"required\": [], \"properties\": {\"customerId\": {\"type\": \"integer\"}, \"firstName\": {\"type\": \"string\"}, \"lastName\": {\"type\": \"string\"}, \"email\": {\"type\": \"string\"}, \"phone\": {\"type\": \"string\"}, \"address\": {\"type\": \"string\"}}}",
    "outputSchema": "{\"title\": \"Customer\", \"type\": \"array\", \"items\": {\"type\": \"object\", \"required\": [\"customerId\", \"firstName\", \"lastName\", \"email\", \"phone\", \"address\"], \"properties\": {\"customerId\": {\"type\": \"integer\"}, \"firstName\": {\"type\": \"string\"}, \"lastName\": {\"type\": \"string\"}, \"email\": {\"type\": \"string\"}, \"phone\": {\"type\": \"string\"}, \"address\": {\"type\": \"string\"}}}}",
    "description": [
      { "type": "text", "value": "This function filters the " },
      { "type": "reference", "referenceType": "database-table", "name": "customers" },
      { "type": "text", "value": " table in the " },
      { "type": "reference", "referenceType": "database", "name": "CRM" },
      { "type": "text", "value": " database based on any combination of optional filter fields: " },
      { "type": "reference", "referenceType": "variable", "name": "customerId", "dataType": "integer" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "firstName", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "lastName", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "email", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "phone", "dataType": "string" },
      { "type": "text", "value": ", and " },
      { "type": "reference", "referenceType": "variable", "name": "address", "dataType": "string" },
      { "type": "text", "value": ". Returns all matching records." }
    ],
    "signature": "async function filterCustomers(filters: FilterCustomersInput): Promise<FilterCustomersResult>",
    "parameters": "/**\n * @param filters - The filter criteria\n * @type {FilterCustomersInput} - Filter parameters object\n */\nfilters: FilterCustomersInput = {\n  customerId?: number;    // Optional customer ID filter\n  firstName?: string;    // Optional first name filter\n  lastName?: string;     // Optional last name filter\n  email?: string;        // Optional email filter\n  phone?: string;        // Optional phone filter\n  address?: string;      // Optional address filter\n}",
    "returns": "/**\n * @returns {Promise<FilterCustomersResult>} Array of customer records matching the filter criteria\n * @typedef {Object} FilterCustomersResult\n * @property {number} customerId - Unique identifier of the customer\n * @property {string} firstName - Customer's first name\n * @property {string} lastName - Customer's last name \n * @property {string} email - Customer's email address\n * @property {string} phone - Customer's phone number\n * @property {string} address - Customer's physical address\n */\nPromise<FilterCustomersResult> where FilterCustomersResult = {\n  customerId: number;\n  firstName: string;\n  lastName: string;\n  email: string;\n  phone: string;\n  address: string;\n}[]",
    "behavior": [
      { "type": "text", "value": "The function filters " },
      { "type": "reference", "referenceType": "database-table", "name": "customers" },
      { "type": "text", "value": " based on provided criteria:\n\n1. Input Handling\n   - All filter parameters are optional\n   - Empty/undefined filters are ignored\n   - String filters use case-insensitive partial matching\n\n2. Query Building\n   - Constructs SQL query with WHERE clauses for provided filters\n   - Uses parameterized queries for security\n   - Combines multiple filters with AND logic\n\n3. Results\n   - Returns array of matching " },
      { "type": "reference", "referenceType": "database-table", "name": "customers" },
      { "type": "text", "value": " records\n   - Returns empty array if no matches found\n   - Maintains original column casing from database" }
    ],
    "errors": "- \`Failed to connect to database\`: Thrown when the database connection cannot be established\n- \`Database query failed\`: Thrown when the database query execution fails\n- \`Invalid customerId: must be a positive integer\`: Thrown when the customerId parameter is not a positive integer\n- \`Invalid firstName: must be a string\`: Thrown when the firstName parameter is not a valid string\n- \`Invalid lastName: must be a string\`: Thrown when the lastName parameter is not a valid string\n- \`Invalid email: must be a string\`: Thrown when the email parameter is not a valid string\n- \`Invalid phone: must be a string\`: Thrown when the phone parameter is not a valid string\n- \`Invalid address: must be a string\`: Thrown when the address parameter is not a valid string",
    "examples": "/**\n * @example\n * // Filter by customer ID\n * const result1 = await filterCustomers({ customerId: 123 });\n * // Returns:\n * // [{\n * //   customerId: 123,\n * //   firstName: 'John',\n * //   lastName: 'Smith', \n * //   email: 'john.smith@email.com',\n * //   phone: '555-0123',\n * //   address: '123 Main St'\n * // }]\n *\n * @example\n * // Filter by partial name match (case-insensitive)\n * const result2 = await filterCustomers({ firstName: 'jo', lastName: 'sm' });\n * // Returns:\n * // [{\n * //   customerId: 123,\n * //   firstName: 'John',\n * //   lastName: 'Smith',\n * //   email: 'john.smith@email.com', \n * //   phone: '555-0123',\n * //   address: '123 Main St'\n * // },\n * // {\n * //   customerId: 456,\n * //   firstName: 'Joseph',\n * //   lastName: 'Smalls',\n * //   email: 'joe.smalls@email.com',\n * //   phone: '555-4567',\n * //   address: '789 Oak Rd'\n * // }]\n *\n * @example\n * // No matches found\n * const result3 = await filterCustomers({ email: 'nonexistent@email.com' });\n * // Returns: []\n *\n * @example\n * // Invalid input throws error\n * try {\n *   const result4 = await filterCustomers({ customerId: -1 });\n * } catch (error) {\n *   // Error: Invalid customerId: must be a positive integer\n * }\n *\n * @example\n * // Complex filter combining multiple fields\n * const result5 = await filterCustomers({\n *   lastName: 'Smith',\n *   address: 'Main St',\n *   phone: '555'\n * });\n * // Returns:\n * // [{\n * //   customerId: 123,\n * //   firstName: 'John', \n * //   lastName: 'Smith',\n * //   email: 'john.smith@email.com',\n * //   phone: '555-0123',\n * //   address: '123 Main St'\n * // }]\n */",
    "resources": [
      {
        "id": "iwwj97jcoae613735mkzjtj2",
        "name": "CRM",
        "metadata": {
          "type": "postgres",
          "tables": [
            {
              "name": "customers",
              "columns": [
                { "name": "customer_id", "dataType": "integer" },
                { "name": "first_name", "dataType": "text" },
                { "name": "last_name", "dataType": "text" },
                { "name": "email", "dataType": "text" },
                { "name": "phone", "dataType": "text" },
                { "name": "address", "dataType": "text" }
              ]
            }
          ]
        },
      }
    ],
    "helperFunctionIds": ["adluv5r0hxfp6230dvuqxdvd"],
  }
}
\`\`\`

# Notes

- Make sure to avoid overwhelming the user with multiple questions at once; take an iterative, question-by-question approach.
- If something is clear enough, just move on the don't ask the user.
- Don't ask too detailed question if everything is clear.`;

export const FUNC_DEVELOPER_PROMPT = `Implement a TypeScript function according to the specifications provided in the guidelines.

Use the provided input and output schemas to define TypeScript types and implement the function signature. Incorporate detailed instructions for implementing logic such as database or API queries, and error handling. Handle all specified edge cases with precision, including correctness for scenarios like empty datasets or invalid inputs. The function code should be exported using the \`export\` keyword, excluding default exports. Utilize Node version 20 or above.

# Steps

1. **Define TypeScript Types:**
   - When defining types for inputs or outputs, make sure to name them after the function name followed by \`Input\` or \`Result\`.

2. **Declare Function Signature:**
   - Specify parameter definitions and return types.

3. **Implement Function Logic:**
   - Implement as per detailed logic instructions involving database or API operations.
   - Use provided helper functions if specified.

4. **Handle Errors and Edge Cases:**
   - Address specified edge cases and incorporate necessary error handling.

5. **Ensure Export Compliance:**
   - Export the function using the \`export\` keyword, skipping default exports.

6. **Node Compliance:**
   - Confirm compatibility with Node version 20 or above.

# Output Format

- Return the complete TypeScript code as plain text.
- Include:
  - Necessary import statements (if explicitly provided).
  - Comprehensive interface/type definitions for inputs and outputs.
  - Full implementation respecting the guidelines, with try-catch for error management.
- Refrain from using any additional formatting like Markdown code blocks.

# Examples

**User Prompt:**

## Context
### Helper Functions Provided

- \`formatCurrency\`
Import from: \`@/lib/formatting\`

Docs:
A utility function that formats numbers as currency strings according to specified locale and currency code.

**Signature:**
function formatCurrency(
  amount: number,
  currencyCode: string,
  locale?: string
): string

**Parameters:**
- amount: Number to format as currency
- currencyCode: ISO 4217 currency code (e.g., 'USD', 'EUR', 'GBP')
- locale: Optional locale string (defaults to 'en-US')

**Returns:**
String representation of the currency value formatted according to locale rules

**Behavior:**
1. Validates input amount is a finite number
2. Validates currency code is valid ISO 4217
3. Formats number using Intl.NumberFormat
4. Returns formatted string

**Errors:**
"Invalid amount" - When amount is not a finite number
"Invalid currency code" - When currency code is not valid
"Invalid locale" - When provided locale is not supported

**Examples:**
formatCurrency(1234.56, 'USD')
// Returns: "$1,234.56"

formatCurrency(1234.56, 'EUR', 'de-DE')
// Returns: "1.234,56 €"

formatCurrency(1234.56, 'JPY')
// Returns: "¥1,235"

### Request
Implement a function called \`calculatePortfolioMetrics\` that has the following specifications:

This function analyzes an array of investment transactions and calculates key portfolio metrics.

**Signature:**
function calculatePortfolioMetrics(transactions: Transaction[]): PortfolioMetrics

**Parameters:**
- \`transactions\` *(Transaction[])*: Array of transaction objects with properties:
  - \`type\` ('buy' | 'sell'): Transaction type
  - \`amount\` (number): Transaction amount
  - \`price\` (number): Price per unit
  - \`timestamp\` (string): ISO 8601 date string
  - \`symbol\` (string): Stock symbol

**Returns:**
- \`PortfolioMetrics\` object with properties:
  - \`totalValue\` (number): Current portfolio value
  - \`totalGainLoss\` (number): Total realized gains/losses
  - \`biggestPosition\` (string): Symbol with largest current position
  - \`transactions\` (TransactionSummary[]): Daily transaction summaries

**Behavior:**
1. Input Validation
   - Verify all transaction objects have required fields
   - Ensure amounts and prices are positive numbers
   - Validate timestamp format

2. Calculations
   - Calculate daily position changes
   - Track running portfolio value
   - Compute realized gains/losses
   - Determine largest position

3. Results
   - Sort transactions chronologically
   - Group transactions by day
   - Format currency values
   - Calculate summary metrics

**Errors:**
- \`Invalid transaction format\`: When transaction objects are malformed
- \`Invalid numerical value\`: When amount or price is not a positive number
- \`Invalid date format\`: When timestamp is not valid ISO 8601
- \`Empty transaction list\`: When input array is empty

**Examples:**
// Example input
const transactions = [
  {
    type: 'buy',
    amount: 100,
    price: 50.25,
    timestamp: '2024-01-01T10:30:00Z',
    symbol: 'AAPL'
  }
];

// Example usage
const metrics = calculatePortfolioMetrics(transactions);
// Returns: {
//   totalValue: 5025.00,
//   totalGainLoss: 0,
//   biggestPosition: 'AAPL',
//   transactions: [{
//     date: '2024-01-01',
//     symbol: 'AAPL',
//     netAmount: 100,
//     value: 5025.00
//   }]
// }

# Note

- Provide the completed TypeScript function implementation, adhering to the outlined requirements and utilizing any specified helper functions or resources.
- Make sure to not override any of the declarations in the current module.
- Only use the resources, helper functions, and imports explicitly stated within the requirements. Never assume the presence of any other helper functions, files, or imports.
- You can only use node.js standard library, unless we explicitly tell you to use something else.
- You should only return the code as a string. No extra comments or formatting.
- You can never use any external libraries, unless we explicitly tell you to use them.
- You can never use any unlisted helper functions. Because they don't exist.
- Don't hallucinate.`;

export const getGenerateFuncCodePrompt = async ({
  currentModuleId,
  name,
  docs,
  resources,
  helperFunctionIds,
  npmDependencies,
}: {
  currentModuleId: string;
  name: string;
  docs: string;
  resources?: z.infer<typeof funcResourceSchema>[];
  helperFunctionIds: string[] | undefined;
  npmDependencies: NpmDependency[] | undefined;
}) => {
  const helperFunctions = await db.query.funcs.findMany({
    where: inArray(funcs.id, helperFunctionIds ?? []),
    with: {
      module: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  let moduleFile = "";

  const module = await db.query.modules.findFirst({
    where: eq(modules.id, currentModuleId),
    with: {
      funcs: true,
    },
  });

  for (const func of module?.funcs ?? []) {
    moduleFile += func.code ?? "";
  }

  const declarationNames = getDeclarationNames(moduleFile);

  return `## Context
${
  resources && resources.length > 0
    ? `### Resources\n${resources
        .map((resource) => {
          switch (resource.metadata.type) {
            case "postgres": {
              const tables = resource.metadata.tables
                .map(
                  (table) =>
                    `- Table \`${table.name}\`
                     - Columns:
                       ${table.columns
                         .map(
                           (column) =>
                             ` - \`${column.name}\` (${column.dataType})`,
                         )
                         .join("\n")}`,
                )
                .join("\n");
              return `- Postgres database \`${resource.name}\`\n${tables}`;
            }
            default:
              throw new Error("Invalid resource type");
          }
        })
        .join("\n\n")}`
    : ""
}

${
  helperFunctions && helperFunctions.length > 0
    ? `### Helper Functions\n${helperFunctions
        .map((helperFunction) => {
          if (!helperFunction.module.name) {
            throw new Error("Helper function module name is required");
          }
          const importInfo =
            helperFunction.moduleId !== currentModuleId
              ? `Available in \`@/lib/${pascalToKebabCase(helperFunction.module.name)}\`\n`
              : "Available in current module can be used directly\n";
          return `- \`${helperFunction.name}\`
How to import: ${importInfo}
Docs:\n${helperFunction.docs}`;
        })
        .join("\n\n")}`
    : ""
}

${
  npmDependencies && npmDependencies.length > 0
    ? `### NPM Dependencies\n${npmDependencies.map((dep) => `- ${dep.name}`).join("\n")}`
    : ""
}

## Current Declarations
Here are all the declarations in the current module:
${declarationNames.map((name) => `- \`${name}\``).join("\n")}

## Request
Implement a function called \`${name}\` that has the following specifications:
${JSON.stringify(docs)}`;
};
