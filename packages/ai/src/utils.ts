import { toCamelCase } from "@specly/shared/utils";

export function getSystemMessage(withResource: boolean): string {
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
Sometimes you will get data from resources that are not in camelCase. In this case you will have to convert it to camelCase.
For example the column name in a table can be in snake_case and you will have to convert it to camelCase in the query.
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

export function getUserMessage({
  resourceInfo,
  functionsToImplement,
  functionality,
}: {
  resourceInfo:
    | {
        name: string;
        type: string;
        actions: string[];
        metadata: string | undefined;
      }
    | undefined;
  functionsToImplement: string[];
  functionality: string;
}): string {
  return `
${
  resourceInfo &&
  `
${resourceInfo.name} information
Type: ${toCamelCase(resourceInfo.type.trim())}

Metadata:
${resourceInfo.metadata}

Available actions for resource "${toCamelCase(resourceInfo.type.trim())}":
${resourceInfo.actions.map((action) => `- ${action}`).join("\n")}

Resource object name:
${toCamelCase(resourceInfo.type.trim())}
  `
}

Functions to implement:
${functionsToImplement.map((functionName) => `- ${functionName}`).join("\n")}

Functionality
${functionality}
`;
}

export function extractCode(
  code: string,
  language: "typescript" | "javascript",
): string | null {
  const regex = new RegExp(`\`\`\`${language}\\s+([\\s\\S]*?)\\s+\`\`\``);
  const match = code.match(regex);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
}
