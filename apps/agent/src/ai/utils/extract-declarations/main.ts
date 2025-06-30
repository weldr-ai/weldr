import { parse } from "@swc/core";
import type { DeclarationData } from "@weldr/shared/types/declarations";
import { processModuleBody } from "./processor";

export async function extractDeclarations({
  sourceCode,
  filename = "input.ts",
  includeNonExported = false,
  projectRoot,
  pathAliases,
}: {
  sourceCode: string;
  filename?: string;
  includeNonExported?: boolean;
  projectRoot: string;
  pathAliases?: Record<string, string>;
}): Promise<DeclarationData[]> {
  try {
    const ast = await parse(sourceCode, {
      syntax: "typescript",
      tsx: filename.endsWith(".tsx"),
      decorators: true,
    });

    const declarations: DeclarationData[] = [];
    const sourceLines = sourceCode.split("\n");

    // Track imported identifiers for dependency analysis
    const importedIdentifiers = new Map<
      string,
      { source: string; isExternal: boolean }
    >();

    await processModuleBody({
      body: ast.body,
      sourceLines,
      filename,
      projectRoot,
      pathAliases,
      declarations,
      importedIdentifiers,
    });

    return declarations;
  } catch (error) {
    throw new Error(
      `Failed to parse TypeScript code: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

async function main() {
  const projectRoot = "/Users/user/project"; // Mock project root
  const pathAliases = {
    "@/": "src/",
    "~modules/": "src/modules/",
  };

  const testCases = [
    {
      name: "Basic Exports",
      filename: "src/basic.ts",
      sourceCode: `
        export const myConst = 123;
        export let myLet = "hello";
        export function myFunction() { return "world"; }
        export class MyClass {
            public prop: string = "test";
            private id: number = 1;
            constructor(id: number) { this.id = id; }
            public getId(): number { return this.id; }
            private utility() {}
        }
        export type MyType = { a: string };
        export interface MyInterface { b: number; }
        export enum MyEnum { A, B }
        export namespace MyNamespace { export const a = 1; }
      `,
    },
    {
      name: "Default Exports",
      filename: "src/defaults.ts",
      sourceCode: `
        export default function myDefaultFunction() {}
        const name = 'world';
        export default name;
        export default class MyDefaultClass {
            public name: string;
            constructor(name: string) {
                this.name = name;
            }
            greet() {
                return \`Hello, \${this.name}\`;
            }
        }
        export default function() {} // Anonymous function
      `,
    },
    {
      name: "Re-exports",
      filename: "src/re-exports.ts",
      sourceCode: `
          export { a, b as c } from './utils';
          export * from './another-util';
          export { type T } from './types';
          export { Button } from 'some-external-lib';
        `,
    },
    {
      name: "Imports and Dependencies",
      filename: "src/dependencies.ts",
      sourceCode: `
            import { utilFunction, utilConst } from './utils';
            import type { AnotherType } from '@/types';
            import DefaultUtil from '~modules/default-util';
            import * as AllUtils from './all-utils';

            const internalConst = 'internal';

            export function usesDependencies(param: AnotherType) {
                console.log(utilConst, internalConst);
                return utilFunction(param);
            }

            export const usesDefault = DefaultUtil.do();

            export const usesNamespace = AllUtils.someFunc();
        `,
    },
    {
      name: "Non-exported declarations",
      filename: "src/non-exported.ts",
      sourceCode: `
            const a = 1;
            function b() { return a; }
            export const c = b();
            type T = string;
            interface I { x: T; }
        `,
    },
    {
      name: "TSX Component",
      filename: "src/component.tsx",
      sourceCode: `
            import React, { useState } from 'react';
            import { Button } from '@/components/ui/button';

            interface MyComponentProps {
                title: string;
            }

            export const MyComponent = ({ title }: MyComponentProps) => {
                const [count, setCount] = useState(0);
                return (
                    <div>
                        <h1>{title}</h1>
                        <p>Count: {count}</p>
                        <Button onClick={() => setCount(c => c + 1)}>Increment</Button>
                    </div>
                );
            };

            export default MyComponent;
        `,
    },
    {
      name: "Complex Syntax",
      filename: "src/complex.ts",
      sourceCode: `
            export const arrowFunc = (a: number): string => \`val: \${a}\`;
            export const { a, b: d } = { a: 1, b: 2 };
            export default function<T extends {id: string}>(arg: T): string {
                 return arg.id;
            }
            export const obj = {
                method() { return 'hello'; }
            }
        `,
    },
    {
      name: "Complex Real-world Example",
      filename: "src/user-service.ts",
      sourceCode: `
            import { BaseService } from './base-service';
            import type { User, UserRole } from './types';

            export interface UserServiceConfig<T = any> {
              maxRetries?: number;
              timeout?: T;
            }

            export type UserStatus = 'active' | 'inactive' | 'pending';

            export async function* processUsers<T extends User>(
              users: T[],
              batchSize: number = 10
            ): AsyncGenerator<T[], void, unknown> {
              for (let i = 0; i < users.length; i += batchSize) {
                yield users.slice(i, i + batchSize);
              }
            }

            export class UserService<T extends User = User> extends BaseService implements UserServiceConfig {
              private readonly cache = new Map<string, T>();
              public static readonly DEFAULT_TIMEOUT = 5000;

              constructor(private config: UserServiceConfig<number>) {
                super();
              }

              async getUser(id: string): Promise<T | null> {
                return this.#cache.get(id) || null;
              }

              static async createService(): Promise<UserService> {
                return new UserService({ timeout: UserService.DEFAULT_TIMEOUT });
              }
            }

            export const userValidator = (user: User): boolean => user.id.length > 0;

            export { type UserRole as Role } from './types';
            export * from './user-utils';
      `,
    },
    {
      name: "Namespace",
      filename: "src/namespace.ts",
      sourceCode: `
        export namespace MyNamespace {
          export const a = 1;
          export function b() { return a; }
          export class C {
            public a: number;
            constructor(a: number) { this.a = a; }
            public getA() { return this.a; }
          }
          export type T = string;
        }
      `,
    },
  ];

  for (const [index, tc] of testCases.entries()) {
    console.log(`\n--- Test Case ${index + 1}: ${tc.name} ---\n`);
    console.log(`File: ${tc.filename}`);
    console.log("\n--- Output ---\n");

    try {
      const declarations = await extractDeclarations({
        sourceCode: tc.sourceCode,
        filename: tc.filename,
        projectRoot,
        pathAliases,
      });
      console.log(JSON.stringify(declarations, null, 2));
    } catch (error) {
      console.error(`Error in test case "${tc.name}":`, error);
    }
    console.log(`\n${"=".repeat(40)}`);
  }
}

main().catch((err) => {
  console.error("Unhandled error in main function:", err);
  process.exit(1);
});
