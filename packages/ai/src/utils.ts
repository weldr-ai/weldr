export function getSystemMessage({
  withResource,
}: {
  withResource: boolean;
}): string {
  return `
Objective:
You are a professional Typescript software developer.
You will be given few requirements and you will write a function code that satisfies theses requirements.
You will be provided with few functions that can be used to write the code.
You should not use any other packages or libraries unless they are explicitly mentioned in the requirements.
You should write a well-typed function by constructing any required interfaces and types.
You should not use any external APIs or services unless they are explicitly mentioned in the requirements.
You should not write any code that is not related to the requirements.
You should write the code in the language of the requirements.
${
  withResource &&
  `
You will receive a list of resources that you have access to and a list of actions that you can perform using these resources.
Each action is a function and you will get its type in the user prompt.
You can use resource by using the resource object that will be available at all time in the global scope.
The resource object will have a function called run and the auth info of type unknown and the type for the run function is
function run(actionName: string, context: Record<string, unknown>): Promise<unknown>
You can use the run and auth in your code by simply calling resourceName.run or resourceName.auth
To run an action you write its name (the function name) and you pass its inputs in the context
`
}

Guidelines:
Function and variable names must be in camelCase.
All function inputs must be created as an object.
Do not write any explanations or comments.
Do not write code that is not syntactically correct.
Do not write code that is not valid.
Do not write code that is not executable.
Do not write code that does not do what the requirements ask.
Do not write any unused types.
Make sure that all the functions have a return type.
You can always implement helper functions if needed but only if needed
Return only the code.
`;
}

interface Table {
  name: string;
  columns: {
    name: string;
    type: string;
  }[];
}

async function getResourceInfo(
  name: string,
  provider: "postgres" | "mysql",
  auth: unknown,
): Promise<string> {
  let resourceActions: string[] = [];
  let resourceGetInfo: (auth: unknown) => Promise<Table[]> = async () => [];

  if (provider === "postgres") {
    // @ts-ignore
    const { actions, getInfo } = await import("@specly/integrations-postgres");
    resourceActions = actions;
    // @ts-ignore
    resourceGetInfo = getInfo;
  }

  return `## Resource \`${name}\`
Provider: \`${provider}\`
Metadata:
${((await resourceGetInfo({ auth })) as Table[])
  .map(
    (table) => `Table: \`${table.name}\`
Columns:
${table.columns.map((column) => `\`${column.name}\` (${column.type})`).join("\n")}`,
  )
  .join("\n\n")}

Available actions for provider \`${provider}\`:
${(resourceActions as string[]).map((action) => `- ${action}`).join("\n")}

Resource object name: \`${provider}\``;
}

export async function getUserMessage({
  resources,
  functionToImplement,
  functionality,
}: {
  resources: {
    name: string;
    provider: "postgres" | "mysql";
    auth: unknown;
  }[];
  functionToImplement: string;
  functionality: string;
}): Promise<string> {
  const resourcesInfo: string[] = [];

  for (const resource of resources) {
    resourcesInfo.push(
      await getResourceInfo(resource.name, resource.provider, resource.auth),
    );
  }

  return `# Resources:
${resourcesInfo.join("\n\n")}

# Function to implement:
${functionToImplement}

# Functionality:
${functionality}
`;
}

export function extractCode(
  code: string,
  language: "typescript" | "python",
): string | null {
  const regex = new RegExp(`\`\`\`${language}\\s*([\\s\\S]*?)\\s*\`\`\``);
  const match = code.match(regex);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
}
