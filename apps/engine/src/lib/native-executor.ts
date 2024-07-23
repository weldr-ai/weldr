import vm from "node:vm";
import ts from "typescript";

import { toCamelCase } from "./utils";

type Context = Record<string, unknown>;

async function compileTypeScript(code: string): Promise<string> {
  const result = ts.transpileModule(code, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  return result.outputText;
}

async function runInVM(code: string, context: Context): Promise<unknown> {
  const vmContext = vm.createContext(context);
  const script = new vm.Script(code);
  return script.runInContext(vmContext) as unknown;
}

export async function runTypeScriptInVM(
  tsCode: string,
  context: Context,
): Promise<unknown> {
  const jsCode = await compileTypeScript(tsCode);
  return await runInVM(jsCode, context);
}

export async function injectResources(
  resources: Record<string, { auth: unknown }>[],
) {
  const resolvedImports: Record<
    string,
    {
      auth: unknown;
      run: (
        actionName: string,
        context: Record<string, unknown>,
      ) => Promise<unknown>;
    }
  > = {};

  for (const resource of resources) {
    const resourceName = Object.keys(resource)[0] as string;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { run } = await import(`@integramind/integrations-${resourceName}`);
    resolvedImports[resourceName] = {
      run: run as (
        actionName: string,
        context: Record<string, unknown>,
      ) => Promise<unknown>,
      auth: (resource[resourceName] as { auth: unknown }).auth,
    };
  }

  return resolvedImports;
}

export async function executeCode(
  code: string,
  resources: Record<string, { auth: unknown }>[],
  inputs: Record<string, unknown>,
) {
  const resolvedResources = await injectResources(resources);
  const result = await runTypeScriptInVM(code, {
    ...resolvedResources,
    ...inputs,
  });
  return result;
}

export async function executePrimitive(
  primitiveName: string,
  code: string,
  resources: Record<string, { auth: unknown }>[],
  inputs: Record<string, unknown>,
) {
  const updatedCode = `
  ${code}
  ${toCamelCase(primitiveName)}({${Object.keys(inputs)
    .map((key) => `${toCamelCase(key)}: ${inputs[key] as string}`)
    .join(", ")}});
  `;
  console.log(updatedCode);
  return await executeCode(updatedCode, resources, inputs);
}
