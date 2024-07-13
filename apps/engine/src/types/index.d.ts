type InitContextParams = {
  isolate: any;
  codeContext: Record<string, unknown>;
};

type ExecuteIsolateParams = {
  isolate: any;
  isolateContext: unknown;
  code: string;
};

export type CodeModule = {
  code(input: unknown): Promise<unknown>;
};

export type CodeSandbox = {
  runCodeModule(params: RunCodeModuleParams): Promise<unknown>;
  runScript(params: RunScriptParams): Promise<unknown>;
};

type RunCodeModuleParams = {
  codeModule: CodeModule;
  inputs: Record<string, unknown>;
};

type RunScriptParams = {
  script: string;
  scriptContext: Record<string, unknown>;
};
