import type { Context, Isolate } from "isolated-vm";

interface InitContextParams {
  isolate: Isolate;
  codeContext: Record<string, unknown>;
}

interface ExecuteIsolateParams {
  isolate: Isolate;
  isolateContext: Context;
  code: string;
}

export interface CodeModule {
  code(input: unknown): Promise<unknown>;
}

export interface CodeSandbox {
  runCodeModule(params: RunCodeModuleParams): Promise<unknown>;
  runScript(params: RunScriptParams): Promise<unknown>;
}

interface RunCodeModuleParams {
  codeModule: CodeModule;
  inputs: Record<string, unknown>;
}

interface RunScriptParams {
  script: string;
  scriptContext: Record<string, unknown>;
}
