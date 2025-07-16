import type { DeclarationCodeMetadata } from "@weldr/shared/types/declarations";
import * as ts from "typescript";
import { processSourceFile } from "./processor";

export async function extractDeclarations({
  sourceCode,
  filename,
  pathAliases,
}: {
  sourceCode: string;
  filename: string;
  pathAliases?: Record<string, string>;
}): Promise<DeclarationCodeMetadata[]> {
  try {
    // Create a TypeScript source file
    const sourceFile = ts.createSourceFile(
      filename,
      sourceCode,
      ts.ScriptTarget.Latest,
      true, // setParentNodes
      filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );

    const declarations: DeclarationCodeMetadata[] = [];
    const sourceLines = sourceCode.split("\n");

    // Track imported identifiers for dependency analysis
    const importedIdentifiers = new Map<
      string,
      { source: string; isExternal: boolean }
    >();

    await processSourceFile({
      sourceFile,
      sourceCode,
      sourceLines,
      filename,
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

// async function main() {
//   console.log("Testing extractDeclarations function...\n");

//   // Test 1: Simple function declaration
//   const test1 = `
// export function calculateSum(a: number, b: number): number {
//   return a + b;
// }

// export const multiply = (x: number, y: number) => x * y;
// `;

//   try {
//     console.log("=== Test 1: Function declarations ===");
//     const result1 = await extractDeclarations({
//       sourceCode: test1,
//       filename: "math.ts",
//     });
//     console.log(JSON.stringify(result1, null, 2));
//   } catch (error) {
//     console.error(
//       "Test 1 failed:",
//       error instanceof Error ? error.message : error,
//     );
//   }

//   console.log("\n");

//   // Test 2: Class and interface declarations
//   const test2 = `
// import { EventEmitter } from 'events';
// import { DatabaseConnection } from './db';

// export interface User {
//   id: string;
//   name: string;
//   email: string;
// }

// export class UserService extends EventEmitter {
//   private db: DatabaseConnection;

//   constructor(db: DatabaseConnection) {
//     super();
//     this.db = db;
//   }

//   async getUser(id: string): Promise<User | null> {
//     return this.db.findUser(id);
//   }
// }
// `;

//   try {
//     console.log("=== Test 2: Class and interface declarations ===");
//     const result2 = await extractDeclarations({
//       sourceCode: test2,
//       filename: "src/lib/user-service.ts",
//       pathAliases: { "@/*": "./src/*" },
//     });
//     console.log(JSON.stringify(result2, null, 2));
//   } catch (error) {
//     console.error("Test 2 failed:", error);
//   }

//   console.log("\n");

//   // Test 3: React component
//   const test3 = `
// import React, { useState, useEffect } from 'react';
// import { Button } from '@/components/ui/button';

// export interface TodoItemProps {
//   id: string;
//   text: string;
//   completed: boolean;
//   onToggle: (id: string) => void;
// }

// export const TodoItem: React.FC<TodoItemProps> = ({ id, text, completed, onToggle }) => {
//   const [isHovered, setIsHovered] = useState(false);

//   useEffect(() => {
//     console.log('TodoItem mounted');
//   }, []);

//   return (
//     <div
//       onMouseEnter={() => setIsHovered(true)}
//       onMouseLeave={() => setIsHovered(false)}
//     >
//       <Button onClick={() => onToggle(id)}>
//         {completed ? '✓' : '○'} {text}
//       </Button>
//     </div>
//   );
// };

// export default TodoItem;
// `;

//   try {
//     console.log("=== Test 3: React component ===");
//     const result3 = await extractDeclarations({
//       sourceCode: test3,
//       filename: "src/components/todo-item.tsx",
//       pathAliases: { "@/*": "./src/*" },
//     });
//     console.log(JSON.stringify(result3, null, 2));
//   } catch (error) {
//     console.error("Test 3 failed:", error);
//   }

//   console.log("\n");

//   // Test 4: Type aliases and enums
//   const test4 = `
// export type Status = 'pending' | 'approved' | 'rejected';

// export enum Priority {
//   Low = 0,
//   Medium = 1,
//   High = 2,
//   Critical = 3
// }

// export type TaskData = {
//   id: string;
//   title: string;
//   status: Status;
//   priority: Priority;
//   createdAt: Date;
// };

// export const defaultTask: TaskData = {
//   id: '',
//   title: '',
//   status: 'pending',
//   priority: Priority.Low,
//   createdAt: new Date()
// };
// `;

//   try {
//     console.log("=== Test 4: Type aliases and enums ===");
//     const result4 = await extractDeclarations({
//       sourceCode: test4,
//       filename: "src/lib/types.ts",
//     });
//     console.log(JSON.stringify(result4, null, 2));
//   } catch (error) {
//     console.error("Test 4 failed:", error);
//   }

//   console.log("\n");

//   // Test 5: Namespace declarations
//   const test5 = `
// export namespace API {
//   export interface User {
//     id: string;
//     name: string;
//   }

//   export class UserService {
//     static async getUser(id: string): Promise<User> {
//       return { id, name: 'John' };
//     }
//   }

//   export const BASE_URL = 'https://api.example.com';

//   export enum Status {
//     Active = 'active',
//     Inactive = 'inactive'
//   }
// }

// namespace Internal {
//   export const SECRET = 'hidden';

//   export function processData(data) {
//     console.log(data);
//     return data;
//   }
// }
// `;

//   try {
//     console.log("=== Test 5: Namespace declarations ===");
//     const result5 = await extractDeclarations({
//       sourceCode: test5,
//       filename: "src/lib/api.ts",
//     });
//     console.log(JSON.stringify(result5, null, 2));
//   } catch (error) {
//     console.error("Test 5 failed:", error);
//   }

//   console.log("\nAll tests completed!");
// }
