import type { Context } from "isolated-vm";
import ivm from "isolated-vm";

import type {
  CodeModule,
  CodeSandbox,
  ExecuteIsolateParams,
  InitContextParams,
} from "../types";

let ivmCache: typeof ivm;

const getIvm = () => {
  if (!ivmCache) {
    ivmCache = ivm;
  }
  return ivmCache;
};

export const codeSandbox: CodeSandbox = {
  async runCodeModule({ codeModule, inputs }) {
    const ivm = getIvm();
    const isolate = new ivm.Isolate({ memoryLimit: 128 });

    try {
      const isolateContext = await initIsolateContext({
        isolate,
        codeContext: {
          inputs,
        },
      });

      const serializedCodeModule = serializeCodeModule(codeModule);

      return await executeIsolate({
        isolate,
        isolateContext,
        code: serializedCodeModule,
      });
    } finally {
      isolate.dispose();
    }
  },

  async runScript({ script, scriptContext }) {
    const ivm = getIvm();
    const isolate = new ivm.Isolate({ memoryLimit: 128 });

    try {
      const isolateContext = await initIsolateContext({
        isolate,
        codeContext: scriptContext,
      });

      return await executeIsolate({
        isolate,
        isolateContext,
        code: script,
      });
    } finally {
      isolate.dispose();
    }
  },
};

const executeIsolate = async ({
  isolate,
  isolateContext,
  code,
}: ExecuteIsolateParams): Promise<unknown> => {
  const isolateScript = await isolate.compileScript(code);

  const outRef = await isolateScript.run(isolateContext, {
    reference: true,
    promise: true,
  });

  return outRef.copy();
};

const initIsolateContext = async ({
  isolate,
  codeContext,
}: InitContextParams): Promise<Context> => {
  const isolateContext = await isolate.createContext();
  const ivm = getIvm();
  for (const [key, value] of Object.entries(codeContext)) {
    await isolateContext.global.set(
      key,
      new ivm.ExternalCopy(value).copyInto(),
    );
  }

  return isolateContext;
};

const serializeCodeModule = (codeModule: CodeModule): string => {
  const serializedCodeFunction = codeModule.code.toString();
  return `const code = ${serializedCodeFunction}; code(inputs);`;
};

let instance: CodeSandbox | null = null;

export const initCodeSandbox = (): CodeSandbox => {
  if (instance === null) {
    instance = codeSandbox;
  }
  return instance;
};
