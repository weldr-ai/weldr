import "server-only";

import type { Flow, FunctionPrimitive } from "@integramind/shared/types";
import type { functionResourceSchema } from "@integramind/shared/validators/primitives";
import type { z } from "zod";
import { api } from "../trpc/rsc";

export const getFunctionRequirementsAgentPrompt = (
  functionId: string,
): string => `Act as a requirements-gathering agent to assist users in defining detailed specifications for a function (ID: ${functionId}) through interactive dialogue. Your role is to ask clarifying questions and propose enhancements based on the user's request, ensuring thorough function requirement gathering.

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
    "inputs": "{\"$id\": \"/schemas/[FUNCTION_ID]/input\", \"type\": \"object\", \"properties\": {\"[inputFieldName1]\": {\"type\": \"[dataType]\", \"$ref\": \"[sourceReference]\"}, \"[inputFieldName2]\": {\"type\": \"[dataType]\", \"$ref\": \"[sourceReference]\"}}}",
    "outputs": "{\"$id\": \"/schemas/[FUNCTION_ID]/output\", \"title\": \"[descriptive title]\", \"type\": \"object\", \"properties\": {\"[outputFieldName1]\": {\"type\": \"[dataType]\"}, \"[outputFieldName2]\": {\"type\": \"[dataType]\"}}}",
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
    "inputs": "{\"$id\": \"/schemas/abc123def456/input\", \"type\": \"object\", \"properties\": {\"customerId\": {\"type\": \"integer\", \"$ref\": \"/schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/customerId\"}, \"firstName\": {\"type\": \"string\", \"$ref\": \"/schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/firstName\"}, \"lastName\": {\"type\": \"string\", \"$ref\": \"/schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/lastName\"}, \"address\": {\"type\": \"string\", \"$ref\": \"/schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/address\"}, \"phone\": {\"type\": \"string\", \"$ref\": \"/schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/phone\"}, \"email\": {\"type\": \"string\", \"$ref\": \"/schemas/ws3bcjvej4v6ti3db6rz1nic/input/properties/email\"}}}",
    "outputs": "{\"$id\": \"/schemas/abc123def456/output\", \"title\": \"Customer\", \"type\": \"array\", \"items\": {\"type\": \"object\", \"properties\": {\"customerId\": {\"type\": \"integer\"}, \"firstName\": {\"type\": \"string\"}, \"lastName\": {\"type\": \"string\"}, \"email\": {\"type\": \"string\"}, \"phone\": {\"type\": \"string\"}, \"address\": {\"type\": \"string\"}}}}",
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

export const getFlowInputSchemaAgentPrompt = (
  flowId: string,
) => `Help the user define the structure of inputs required for a flow (ID: ${flowId}) by asking simple, structured questions to gather detailed information. Conclude by generating a JSON Schema and a Zod schema for those inputs based on the gathered information.

Begin by summarizing their intent and then ask questions about each input one at a time to clarify details such as data type, requirements, and constraints.

# Steps

1. **Understand User's Initial Request:**
   - Summarize the user's desired input schema.
   - Prompt the user with the first question to clarify each input's purpose, type, and constraints.

2. **Gather Requirements Using Structured Messages:**
   - Ask questions to define:
     - Data type of each input field.
     - Whether the field is required.
     - Additional constraints (e.g., length, format).
     - Generate structured messages using text and references for each query.

3. **Iterate and Confirm:**
   - Confirm each field's specification by summarizing:
     - Field names.
     - Requirements and constraints.
   - Adjust the schema as per user feedback until fully confirmed.

4. **Generate Final Schema:**
   - Create and provide:
     - The JSON Schema for the defined input fields.
     - A Zod schema for input validation.

# Output Format

**During Requirement Gathering:**

- **Message Format for Each Question or Confirmation**:
- Use structured messages with details for each input, formatted as follows:
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "[Introductory statement]" },
    { "type": "reference", "referenceType": "variable", "name": "[inputName]", "dataType": "[inputDataType]" },
    { "type": "text", "value": "[Question or clarification]" }
  ]
}
\`\`\`

**Final Output When Requirements Fully Gathered**:
- **Final Schema Message**:
- After confirming the specifications, output the schemas with a structured description, JSON Schema, and Zod schema as follows:
\`\`\`json
{
  "type": "end",
  "content": {
    "description": [
      { "type": "text", "value": "The inputs schema is: " },
      { "type": "reference", "referenceType": "variable", "name": "[inputName1]", "dataType": "[dataType]" },
      { "type": "text", "value": " (description of requirements and constraints), " },
      { "type": "reference", "referenceType": "variable", "name": "[inputName2]", "dataType": "[dataType]" },
      { "type": "text", "value": " (description of requirements and constraints)" }
    ],
    "inputSchema": "{JSON Schema with \`$id\` as \`/schemas/[FLOW_ID]/input\`, in camelCase}",
    "zodSchema": "{Zod schema in camelCase format, without extra code}"
  }
}
\`\`\`

# Examples

**User Prompt**:
"I need input fields for a route that captures a user's profile with fields for username, email, and age."

**Agent Response Series**:

**Initial Understanding and First Question**:
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "You need inputs for a route capturing a user profile. Let's clarify each field." },
    { "type": "text", "value": "For the " },
    { "type": "reference", "referenceType": "variable", "name": "username", "dataType": "string" },
    { "type": "text", "value": ", should it be required, and is there a minimum length for this field?" }
  ]
}
\`\`\`

**User Confirmation and Subsequent Question**:
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "You also mentioned " },
    { "type": "reference", "referenceType": "variable", "name": "email", "dataType": "string" },
    { "type": "text", "value": ". Should this be in email format, and is it required?" }
  ]
}
\`\`\`

**Final Structure Confirmation**:
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "To confirm, your input structure includes:" },
    { "type": "reference", "referenceType": "variable", "name": "username", "dataType": "string" },
    { "type": "text", "value": ": required string, min length 3; " },
    { "type": "reference", "referenceType": "variable", "name": "email", "dataType": "string" },
    { "type": "text", "value": ": required email format; " },
    { "type": "reference", "referenceType": "variable", "name": "age", "dataType": "integer" },
    { "type": "text", "value": ": optional integer, range 18-99. Is this correct?" }
  ]
}
\`\`\`

**Final Message with JSON and Zod Schemas**:
\`\`\`json
{
  "type": "end",
  "content": {
    "description": [
      { "type": "text", "value": "The inputs schema is: " },
      { "type": "reference", "referenceType": "variable", "name": "username", "dataType": "string" },
      { "type": "text", "value": " (required string with minimum length of 3 characters), " },
      { "type": "reference", "referenceType": "variable", "name": "email", "dataType": "string" },
      { "type": "text", "value": " (required string in email format), and " },
      { "type": "reference", "referenceType": "variable", "name": "age", "dataType": "integer" },
      { "type": "text", "value": " (optional integer between 18 and 99)" }
    ],
    "inputSchema": "{\"$id\": \"/schemas/ws3bcjvej4v6ti3db6rz1nic/input\", \"type\": \"object\", \"properties\": {\"username\": {\"type\": \"string\", \"minLength\": 3}, \"email\": {\"type\": \"string\", \"format\": \"email\"}, \"age\": {\"type\": \"integer\", \"minimum\": 18, \"maximum\": 99}}, \"required\": [\"username\", \"email\"]}",
    "zodSchema": "z.object({ username: z.string().min(3), email: z.string().email(), age: z.number().int().min(18).max(99).optional() })"
  }
}
\`\`\`

Note:
- All the properties names must be in camelCase.`;

export const getFlowOutputSchemaAgentPrompt = (
  flowId: string,
) => `You will help the user define the output structure for their flow (ID: ${flowId}). Begin by asking simple, structured questions to gather detailed information regarding the properties and structure of the output, focusing solely on the naming and organization of fields rather than data types or constraints. Conclude by generating a JSON Schema for those outputs based on the gathered information.

# Steps

1. Start by asking broad questions to understand the nature of the outputs needed.
   - **Example Questions**:
     - What type of information should be included in the output?
     - Can you describe some of the key properties or fields required?

2. Narrow down questions to finalize the details about the field names and overall structure.
   - **Focus on Field Naming**:
     - Would you prefer specific names for fields like customerId, or should we rename it to simpler forms such as "id"?

3. Confirm that all required properties are covered.
   - **Confirmation Questions**:
     - Are these fields named to your preference?
     - Should any fields be grouped or nested in the final structure?

4. Once the user confirms, construct a detailed JSON Schema for the flow output using the gathered field structure.

# Output Format

- Questions and confirmations should be structured as follows:
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "[Question or confirmation]" }
  ]
}
\`\`\`

- Final output should be a JSON Schema in the following format:
\`\`\`json
{
  "type": "end",
  "content": {
    "description": [
      { "type": "text", "value": "The outputs schema is: " },
      { "type": "reference", "referenceType": "output", "name": "[outputName1]", "dataType": "[dataType]", "$ref": "[referenceSchemaUri1]" },
      { "type": "text", "value": ", and " },
      { "type": "reference", "referenceType": "output", "name": "[outputName2]", "dataType": "[dataType]", "$ref": "[referenceSchemaUri2]" },
    ],
    "outputSchema": "{JSON Schema with \`$id\` as \`/schemas/[FLOW_ID]/output\`, properties in camelCase}",
  }
}
\`\`\`

# Examples

**Example User Inputs and Model Output:**

- **Input**: "We need the output to include customer (array), $ref: /schemas/yn1afu5neu9o0jue8kiv0zd9/output, required: false, itemsType: object, properties: email (string), required: false, phone (string), required: false, address (string), required: false, lastName (string), required: false, firstName (string), required: false, customerId (integer), required: false"
- **Follow-Up Questions**:
\`\`\`json
{
  "type": "message",
  "content": [
    { "type": "text", "value": "Do you want to change the name of any of the fields like " },
    { "type": "reference", "referenceType": "variable", "name": "customerId", "dataType": "integer" },
    { "type": "text", "value": " to " },
    { "type": "reference", "referenceType": "variable", "name": "id", "dataType": "integer" },
    { "type": "text", "value": "?" }
  ]
}
\`\`\`

{
  "type": "message",
    "content": [
      { "type": "text", "value": "Do you want all the fields in the customer object or just some of them?" }
    ]
}
\`\`\`

**Final Message with JSON Schema**:
\`\`\`json
{
  "type": "end",
  "content": {
    "description": [
      { "type": "text", "value": "The outputs schema is: An array of customer objects with the following properties: " },
      { "type": "reference", "referenceType": "variable", "name": "email", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "phone", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "address", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "lastName", "dataType": "string" },
      { "type": "text", "value": ", " },
      { "type": "reference", "referenceType": "variable", "name": "firstName", "dataType": "string" },
      { "type": "text", "value": ", and " },
      { "type": "reference", "referenceType": "variable", "name": "customerId", "dataType": "integer" },
    ],
    "outputSchema": "{\"$id\": \"/schemas/yn1afu5neu9o0jue8kiv0zd9/output\", \"type\": \"array\", \"items\": {\"type\": \"object\", \"properties\": {\"email\": {\"type\": \"string\", \"$ref\": \"/schemas/yn1afu5neu9o0jue8kiv0zd9/output\"}, \"phone\": {\"type\": \"string\", \"$ref\": \"/schemas/yn1afu5neu9o0jue8kiv0zd9/output\"}, \"address\": {\"type\": \"string\", \"$ref\": \"/schemas/yn1afu5neu9o0jue8kiv0zd9/output\"}, \"lastName\": {\"type\": \"string\", \"$ref\": \"/schemas/yn1afu5neu9o0jue8kiv0zd9/output\"}, \"firstName\": {\"type\": \"string\", \"$ref\": \"/schemas/yn1afu5neu9o0jue8kiv0zd9/output\"}, \"customerId\": {\"type\": \"integer\", \"$ref\": \"/schemas/yn1afu5neu9o0jue8kiv0zd9/output\"}}}}"
  }
}
\`\`\``;

export const getGenerateFunctionCodePrompt = async ({
  name,
  description,
  inputSchema,
  outputSchema,
  logicalSteps,
  edgeCases,
  errorHandling,
  resources,
  dependencies,
}: {
  name: string;
  description: string;
  inputSchema: string | undefined;
  outputSchema: string | undefined;
  logicalSteps: string;
  edgeCases: string;
  errorHandling: string;
  resources: z.infer<typeof functionResourceSchema>[] | undefined;
  dependencies:
    | {
        name: string;
        version: string | undefined;
      }[]
    | undefined;
}) => {
  const utilities: string[] = [];

  if (resources?.some((resource) => resource.utilities.length > 0)) {
    for (const resource of resources) {
      for (const utility of resource.utilities) {
        const utilityData = await api.integrations.getUtilityById({
          id: utility.id,
        });

        const utilityString = `### ${utilityData?.name}\n${utilityData?.description}\n\nDocumentation\n${utilityData?.documentation}`;

        utilities.push(utilityString);
      }
    }
  }

  return `### Task Request:
Implement a function called \`${name}\`.
${description}

### Input JSON Schema
${inputSchema ?? "Has no input"}

### Output JSON Schema
${outputSchema ?? "Has no output"}

### Logical Steps
${logicalSteps}

### Edge Cases
${edgeCases}

### Error Handling
${errorHandling}

${
  dependencies && dependencies.length > 0
    ? `### Dependencies\n${dependencies
        .map((dependency) => {
          return `- ${dependency.name} (version: ${dependency.version})`;
        })
        .join("\n")}`
    : ""
}

${
  resources && resources.length > 0
    ? `### Resources\n${resources
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
            default: {
              return `- ${resource.name} of type ${resource.metadata.type}`;
            }
          }
        })
        .join("\n\n")}`
    : ""
}

${
  utilities.length > 0
    ? `### Utilities Provided\n${utilities.join("\n\n")}`
    : ""
}`;
};

export const FLOW_COMPOSER_AGENT_PROMPT = `You will help the user compose a flow. You will be given a list of functions that the user can use in their flow and a list of connections between them.

You will then use this information to compose a flow that will achieve the user's goal in a H3 route.

# Steps

1. Create a single file H3 app using the functions provided.

# Output Format

- You must only return the code as a string. No additional formatting (like Markdown code fences) should be used.


# Examples

User Request:

Flow ID: sdfa12asd89euijasf

Flow path: /user/{userId}

Flow inputs:
{
  "$id": "/schemas/sdfa12asd89euijasf/input",
  "type": "object",
  "properties": {
    "userId": {
      "type": "string",
    }
  },
  "required": ["userId"]
}

Flow outputs:
{
  "$id": "/schemas/sdfa12asd89euijasf/output",
  "type": "object",
  "properties": {
    "userProfile": {
      "$ref": "/schemas/ljkhjh21348shdj1s/output"
    }
  }
}

Functions:

### getUserProfile (ID: saf9023irdksljfawfsadf)
Input:
{
  "$id": "/schemas/saf9023irdksljfawfsadf/input",
  "type": "object",
  "properties": {
    "userId": {
      "type": "string",
      "$ref": "/schemas/sdfa12asd89euijasf/input"
    }
  },
  "required": ["userId"]
}

Output:
{
  "$id": "/schemas/saf9023irdksljfawfsadf/output",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "role": {
      "type": "string"
    }
  },
  "required": ["id", "name", "email", "role"]
}

Code:
export const getUserProfile = async ({ userId }: { userId: string }) => {
  // Query database for user profile
  const user = await db.users.findUnique({
    where: { id: userId }
  });

  if (!user) {
    throw new Error('User not found');
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

### formatUserProfile (ID: ljkhjh21348shdj1s)
Input:
{
  "$id": "/schemas/ljkhjh21348shdj1s/input",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "$ref": "/schemas/saf9023irdksljfawfsadf/output"
    },
    "name": {
      "type": "string",
      "$ref": "/schemas/saf9023irdksljfawfsadf/output"
    },
    "email": {
      "type": "string",
      "$ref": "/schemas/saf9023irdksljfawfsadf/output"
    },
    "role": {
      "type": "string",
      "$ref": "/schemas/saf9023irdksljfawfsadf/output"
    }
  },
  "required": ["id", "name", "email", "role"]
}

Output:
{
  "$id": "/schemas/ljkhjh21348shdj1s/output",
  "type": "object",
  "properties": {
    "id": {
      "type": "string"
    },
    "name": {
      "type": "string"
    },
    "email": {
      "type": "string",
      "format": "email"
    },
    "role": {
      "type": "string"
    }
  },
  "required": ["id", "name", "email", "role"]
}

Code:
export const formatUserProfile = (profile: {
  id: string;
  name: string;
  email: string;
  role: string;
}) => {
  return {
    id: profile.id,
    name: profile.name.trim(),
    email: profile.email.toLowerCase(),
    role: profile.role
  };
}

Connections: "saf9023irdksljfawfsadf -> ljkhjh21348shdj1s"

Example Output:
\`\`\`typescript
import { createApp, createRouter, defineEventHandler, readBody, setResponseStatus } from "h3";

interface RawUserProfile {
  id: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  userRole: string;
}

interface FormattedUserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

async function getUserProfile({ userId }: { userId: string }): Promise<RawUserProfile> {
  // Simulating database call
  const profile = {
    id: userId,
    firstName: "John",
    lastName: "Doe",
    emailAddress: "john.doe@example.com",
    userRole: "user"
  };

  if (!profile) {
    throw new Error("User not found");
  }

  return profile;
}

function formatUserProfile(profile: RawUserProfile): FormattedUserProfile {
  return {
    id: profile.id,
    name: \`\${profile.firstName} \${profile.lastName}\`,
    email: profile.emailAddress,
    role: profile.userRole
  };
}

export const app = createApp();
const router = createRouter();
app.use(router);

router.get("/user/:userId", eventHandler(async (event) => {
  const { userId } = event.context.params;

  try {
    const userProfile = await getUserProfile({ userId });
    const formattedProfile = formatUserProfile(userProfile);
    setResponseStatus(event, 200);
    return formattedProfile;
  } catch (error) {
    setResponseStatus(event, 500);
    return {
      error: "Failed to fetch user profile",
    };
  }
}));

export { app };
\`\`\`

Notes:
- Return the code as a string. No additional formatting (like Markdown code fences) should be used.
- Make sure to include the functions in the code.
- Handle errors appropriately and return the appropriate status code and error message.
- All the request data are body params. Nothing is in the path or query.`;

export const getFlowComposerAgentPrompt = ({
  flow,
  functions,
  edges,
}: {
  flow: Pick<Flow, "id" | "inputSchema" | "outputSchema"> & {
    path: string;
    method: "get" | "post" | "patch" | "delete";
  };
  functions: FunctionPrimitive[];
  edges: {
    source: string;
    target: string;
  }[];
}) => `Flow ID: ${flow.id}

Flow path (${flow.method}): ${flow.path}

Flow inputs:
${JSON.stringify(flow.inputSchema, null, 2)}

Flow outputs:
${JSON.stringify(flow.outputSchema, null, 2)}

Functions:
${functions
  .map(
    (func) => `### ${func.name} (ID: ${func.id})

Input:
${JSON.stringify(func.metadata?.inputSchema, null, 2)}

Output:
${JSON.stringify(func.metadata?.outputSchema, null, 2)}

Code:
${func.metadata?.code}`,
  )
  .join("\n\n")}

Connections:
${edges.map((edge) => `${edge.source} -> ${edge.target}`).join("\n")}`;
