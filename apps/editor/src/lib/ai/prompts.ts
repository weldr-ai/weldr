import "server-only";

import type { Package } from "@integramind/shared/types";
import type { primitiveResourceSchema } from "@integramind/shared/validators/primitives";
import type { z } from "zod";
import { api } from "../trpc/server";

export const getPrimitiveRequirementsAgentPrompt = (
  primitiveId: string,
): string => `Act as a requirements-gathering agent to assist users in defining detailed specifications for a function (ID: ${primitiveId}) through interactive dialogue. Your role is to ask clarifying questions and propose enhancements based on the user's request, ensuring thorough function requirement gathering.

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
     - Lists of all resources and utilities involved.
     - Consideration of key edge cases and error-handling strategies.
     - Any dependencies (e.g. external modules, databases).

# Output Format

- **Question and Verification Messages:**
  - Each prompt you present should contain one targeted question to gather a specific piece of information.
  - If the user request doesn't require too many clarifying questions, then just skip steps. Also steps are not required to be in order.
  - Format each response with structured content for questions or explanations, using \`text\` for text values and \`reference\` fields for inputs, databases, database tables, and database columns, and utilities.

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
    "inputs": "{\"type\": \"object\", \"properties\": {\"[inputFieldName1]\": {\"type\": \"[dataType]\"}, \"[inputFieldName2]\": {\"type\": \"[dataType]\"}}}",
    "outputs": "{\"title\": \"[descriptive title]\", \"type\": \"object\", \"properties\": {\"[outputFieldName1]\": {\"type\": \"[dataType]\"}, \"[outputFieldName2]\": {\"type\": \"[dataType]\"}}}",
    "description": [
      { "type": "text", "value": "This function filters data from " },
      { "type": "reference", "referenceType": "database-table", "name": "customers" },
      { "type": "text", "value": " based on provided inputs and returns filtered results." }
    ],
    "resources": [
      {
        "id": "[resourceId]",
        "name": "[resourceName]",
        "metadata": {
          "type": "[resourceType]",
          ...
        },
        "utilities": [
          { "id": "[utilityId]", "name": "[utilityName]", "description": "[utilityDescription]" }
        ]
      }
    ],
    "logicalSteps": [
      { "type": "text", "value": "1. Define all the required types. 2. Use the " },
      { "type": "reference", "referenceType": "utility-function", "name": "[utilityName]" },
      { "type": "text", "value": " utility to query the database with the specified filters. 3. Sort and structure results. 4. Return the final output." }
    ],
    "edgeCases": "Handle scenarios with no matching records and any null values in filtering fields.",
    "errorHandling": "If database query fails, log the error and return a user-friendly message. No retry mechanism for now.",
    "dependencies": []
  }
}
\`\`\`

# Examples

**User Prompt:**
I want to filter the table customers, with columns: customer_id (integer) first_name (text) last_name (text) email (text) phone (text) address (text), in database CRM (ID: iwwj97jcoae613735mkzjtj2), with utilities: name: query (ID: adluv5r0hxfp6230dvuqxdvd), description: Executes a SQL query with parameters and returns the result. using the inputs input customerId (integer), $ref: /schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/customerId, required: false, input firstName (string), $ref: /schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/firstName, required: false, input lastName (string), $ref: /schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/lastName, required: false, input email (string), $ref: /schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/email, required: false, input phone (string), $ref: /schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/phone, required: false, and input address (string), $ref: /schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/address, required: false.

**Agent Response Example: Initial Clarification**
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "What specific filter criteria should be applied to the " },
    { "type": "reference", "referenceType": "variable", "name": "customerId", "dataType": "integer" },
    { "type": "text", "value": " field? Should it match exactly, or do you have specific range criteria?" }
  ]
}
\`\`\`

**Example Final Structured Function Description**
\`\`\`json
{
  "type": "end",
  "content": {
    "inputs": "{\"type\": \"object\", \"properties\": {\"customerId\": {\"type\": \"integer\"}, \"firstName\": {\"type\": \"string\"}, \"lastName\": {\"type\": \"string\"}, \"address\": {\"type\": \"string\"}, \"phone\": {\"type\": \"string\"}, \"email\": {\"type\": \"string\"}}}",
    "outputs": "{\"title\": \"Customer\", \"type\": \"array\", \"items\": {\"type\": \"object\", \"properties\": {\"customerId\": {\"type\": \"integer\"}, \"firstName\": {\"type\": \"string\"}, \"lastName\": {\"type\": \"string\"}, \"email\": {\"type\": \"string\"}, \"phone\": {\"type\": \"string\"}, \"address\": {\"type\": \"string\"}}}}",
    "description": [
      { "type": "text", "value": "This function filters the " },
      { "type": "reference", "referenceType": "database-table", "name": "customers" },
      { "type": "text", "value": " table in the " },
      { "type": "reference", "referenceType": "database", "name": "CRM" },
      { "type": "text", "value": " database based on input fields " },
      { "type": "reference", "referenceType": "variable", "name": "customerId", "dataType": "integer" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "firstName", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "lastName", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "address", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "phone", "dataType": "string" },
      { "type": "text", "value": ", and " },
      { "type": "reference", "referenceType": "variable", "name": "email", "dataType": "string" },
      { "type": "text", "value": ", and returns matching records." }
    ],
    "resources": [
      {
        "id": "iwwj97jcoae613735mkzjtj2",
        "name": "CRM",
        "metadata": {
          "type": "database",
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
        "utilities": [
          {
            "id": "adluv5r0hxfp6230dvuqxdvd",
            "name": "query",
            "description": "Executes a SQL query with parameters and returns the result."
          }
        ]
      }
    ],
    "logicalSteps": [
      { "type": "text", "value": "1. Build a SQL query with dynamic WHERE clauses for each provided input filter:\n- Add " },
      { "type": "reference", "referenceType": "variable", "name": "customerId", "dataType": "integer" },
      { "type": "text", "value": " exact match if provided.\n- Add " },
      { "type": "reference", "referenceType": "variable", "name": "firstName", "dataType": "string" },
      { "type": "text", "value": " pattern match if provided.\n- Add " },
      { "type": "reference", "referenceType": "variable", "name": "lastName", "dataType": "string" },
      { "type": "text", "value": " pattern match if provided.\n- Add " },
      { "type": "reference", "referenceType": "variable", "name": "email", "dataType": "string" },
      { "type": "text", "value": " pattern match if provided.\n- Add " },
      { "type": "reference", "referenceType": "variable", "name": "phone", "dataType": "string" },
      { "type": "text", "value": " pattern match if provided.\n- Add " },
      { "type": "reference", "referenceType": "variable", "name": "address", "dataType": "string" },
      { "type": "text", "value": " pattern match if provided.\n2. Use the " },
      { "type": "reference", "referenceType": "database", "name": "CRM" },
      { "type": "text", "value": "'s " },
      { "type": "reference", "referenceType": "utility-function", "name": "query" },
      { "type": "text", "value": " utility to execute the SQL query with proper parameter binding.\n3. Map the query results to match the output schema structure:\n- Ensure all column names match the schema properties.\n- Convert any null values to appropriate defaults.\n4. Return an empty array if no matching records are found.\n5. Return the filtered and mapped customer records array." }
    ],
    "edgeCases": "Handle scenarios with no matching records and any null values in filtering fields.",
    "errorHandling": "If database query fails, log the error and return a user-friendly message. No retry mechanism for now.",
    "dependencies": []
  }
}
\`\`\`

# Notes
- Make sure to avoid overwhelming the user with multiple questions at once; take an iterative, question-by-question approach.
- If something is clear enough, just move on the don't ask the user.
- Avoid discussing input validations; focus solely on functional aspects and user interactions.`;

export const FUNCTION_DEVELOPER_PROMPT = `Implement the function as per given guidelines, utilizing the provided imports, type definitions, logical steps, and handling of edge cases appropriately.

# Steps

1. **Define TypeScript Types** based on the provided input and output schemas.
2. **Declare the Function Signature** and outline parameter definitions and return types.
3. **Use or Define Helper Functions** to ensure clean, readable code (if needed).
4. **Implement Logic** as per the detailed instructions provided, such as database or API queries and error handling.
5. **Handle All Edge Cases** precisely as specified. Confirm correctness for scenarios such as empty datasets or invalid inputs.
6. **Return Completed Code** as a textual TypeScript snippet with all necessary imports and definitions.

# Output Format

- Provide TypeScript code as **plain text**.
- It should include:
  - Import statements (only if explicitly provided).
  - Complete interface/type definitions relating to inputs and outputs.
  - Function implementation matching the requirements, with appropriate try-catch handling for errors.

**Do not use any additional formatting (such as Markdown code blocks). Only provide syntactically correct, runnable TypeScript code.**

# Examples

## Input Example:

### Task Request:
Implement a function called \`getCustomerById\`.
This function gets the customer by id from the table customers table in the database CRM based on input field input customerId (integer).

### Input JSON Schema
{
  "type": "object",
  "properties": {
    "customerId": {
      "type": "integer"
    }
  },
  "required": ["customerId"]
}

### Output JSON Schema
{
  "type": "object",
  "title": "Customer",
  "properties": {
    "id": { "type": "integer" },
    "firstName": { "type": "string" },
    "lastName": { "type": "string" },
    "email": { "type": "string" },
    "phone": { "type": "string" },
    "address": { "type": "string" }
  }
}

### Logical Steps
- Use the \`query\` utility to get the customer by id.
- Return the customer if found, otherwise return \`undefined\`.

### Edge Cases
- Handle scenarios where the customer is not found.

### Error Handling
- If the query fails, log the error and throw a user-friendly message.

### Resources
CRM of type Postgres database with the following tables:
- customers, with columns, customer_id (integer), first_name (text), last_name (text), email (text), phone (text), address (text)

### Utilities Provided

#### query
Executes a SQL query with parameters and returns the result.

Documentation:
**Parameters:**
- \`text\` *(string)*: The SQL query text
- \`params\` *(unknown[])*: Array of parameter values to use in the query

**Returns:**
- \`Promise<QueryResult<T>>\`: Resolves to the query result

**Example:**
\`\`\`typescript
import { query } from "./lib/db";

interface User {
  id: number;
  name: string;
  email: string;
}

const rows = await query<User>(
  "SELECT * FROM users WHERE id = $1",
  [1],
);

const user = rows.rows[0];
console.log(user);
// Output: { id: 1, name: 'John Doe', email: 'john.doe@example.com' }
\`\`\`

## Expected Output Example:

\`\`\`typescript
import { query } from "./lib/db"

interface Customer {
  customerId: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
}

async function getCustomerById({ customerId }: { customerId: number }): Promise<Customer | undefined> {
  try {
    const result = await query<Customer>(
      "SELECT customer_id as \"customerId\", first_name as \"firstName\", last_name as \"lastName\", email, phone, address FROM customers WHERE customer_id = $1",
      [customerId]
    );

    if (result.rows.length === 0) {
      return undefined;
    }

    return result.rows[0];
  } catch (error) {
    console.error("Error fetching customer:", error);
    throw new Error("Failed to retrieve customer information");
  }
}
\`\`\`

# Note

- Only use the resources, utilities, and imports explicitly stated within the requirements. Never assume the presence of any other utilities, files, or imports.
- You can only use node.js standard library, unless we explicitly tell you to use something else.
- You should only return the code as a string. No extra comments or formatting.
- You can never use any external libraries, unless we explicitly tell you to use them.
- You can never use any unlisted utilities. Because they don't exist.
- Don't hallucinate.`;

export const getGeneratePrimitiveCodePrompt = async ({
  name,
  description,
  inputSchema,
  outputSchema,
  logicalSteps,
  edgeCases,
  errorHandling,
  resources,
  usedPrimitiveIds,
  usedUtilityIds,
  packages,
}: {
  name: string;
  description: string;
  inputSchema: string | undefined;
  outputSchema: string | undefined;
  logicalSteps: string;
  edgeCases: string;
  errorHandling: string;
  resources: z.infer<typeof primitiveResourceSchema>[] | undefined;
  usedPrimitiveIds: string[] | undefined;
  usedUtilityIds: string[] | undefined;
  packages: Package[] | undefined;
}) => {
  const utilities: string[] = [];

  const usedPrimitives = await api.primitives.byIds({
    ids: usedPrimitiveIds ?? [],
  });

  const usedUtilities = await api.flows.utilitiesByIds({
    ids: usedUtilityIds ?? [],
  });

  if (resources?.some((resource) => resource.utilities.length > 0)) {
    for (const resource of resources) {
      for (const utility of resource.utilities) {
        const utilityData = await api.integrations.utilityById({
          id: utility.id,
        });

        const utilityString = `### ${utilityData?.name}\n${utilityData?.description}\n\nDocumentation\n${utilityData?.documentation}`;

        utilities.push(utilityString);
      }
    }
  }

  return `Implement a TypeScript function based on the given requirements and specifications.

## Task Request
Implement a function called \`${name}\`.
- **Description**: ${description}

## Input and Output Schemas
- **Input JSON Schema**: ${inputSchema ?? "Has no input"}
- **Output JSON Schema**: ${outputSchema ?? "Has no output"}

## Steps

- **Logical Steps**:
  - ${logicalSteps}

- **Edge Cases**:
  - ${edgeCases}

- **Error Handling**:
  - ${errorHandling}

${
  packages && packages.length > 0
    ? `## Packages\n${packages.map((pkg) => `- ${pkg.name} (version: ${pkg.version})`).join("\n")}`
    : ""
}

${
  resources && resources.length > 0
    ? `## Resources\n${resources
        .map((resource) => {
          switch (resource.metadata.type) {
            case "database": {
              const tables = resource.metadata.tables
                .map(
                  (table) =>
                    `- ${table.name}, with columns, ${table.columns
                      .map((column) => `${column.name} (${column.dataType})`)
                      .join(", ")}`,
                )
                .join("\n");
              return `- ${resource.name} of type ${resource.metadata.type} with the following tables:\n${tables}`;
            }
            default:
              return `- ${resource.name} of type ${resource.metadata.type}`;
          }
        })
        .join("\n\n")}`
    : ""
}

${
  utilities.length > 0 || usedUtilities.length > 0 || usedPrimitives.length > 0
    ? "## Utilities to use"
    : ""
}

${utilities.length > 0 ? utilities.join("\n\n") : ""}

${
  usedUtilities && usedUtilities.length > 0
    ? `The following utilities can be imported from the \`@/lib/[UTILITY_NAME].ts\` file:\n${usedUtilities
        .map((utility) => {
          return `- ${utility.name}
Description: ${utility.description}
${utility.inputSchema ? `Input Schema: ${JSON.stringify(utility.inputSchema)}` : ""}
${utility.outputSchema ? `Output Schema: ${JSON.stringify(utility.outputSchema)}` : ""}`;
        })
        .join("\n\n")}`
    : ""
}

${
  usedPrimitives && usedPrimitives.length > 0
    ? `The following utilities are in the same file and can be used directly and don't need to be implemented or imported:\n${usedPrimitives
        .map((primitive) => {
          return `- ${primitive.name}
Description: ${primitive.description}
${primitive.inputSchema ? `Input Schema: ${JSON.stringify(primitive.inputSchema)}` : ""}
${primitive.outputSchema ? `Output Schema: ${JSON.stringify(primitive.outputSchema)}` : ""}
${primitive.logicalSteps ? `Logical Steps: ${primitive.logicalSteps}` : ""}
${primitive.edgeCases ? `Edge Cases: ${primitive.edgeCases}` : ""}
${primitive.errorHandling ? `Error Handling: ${primitive.errorHandling}` : ""}`;
        })
        .join("\n\n")}`
    : ""
}

# Output Format

Provide the completed TypeScript function implementation, adhering to the outlined requirements and utilizing any specified utilities or resources.`;
};
