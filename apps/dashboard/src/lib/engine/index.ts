// "use server";

// import { Isolate } from "isolated-vm";
// import OpenAI from "openai";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

// export type CodeGeneratorRole = "SQL" | "Typescript";

// function extractCode(text: string) {
//   const codeRegex = /```(?:javascript|typescript|sql)\n([\s\S]*?)```/g;
//   const matches = text.match(codeRegex);
//   if (matches) {
//     return matches[0];
//   }
//   return null;
// }

// export async function codeGenerator(
//   role: CodeGeneratorRole,
//   userPrompt: string,
// ) {
//   const systemPrompt = `
//     You are a professional ${role} software developer.
//     You will be given few requirements and you will write a function code that satisfies theses requirements.
//     You will be provided with few functions that can be used to write the code.
//     You should not use any other packages or libraries unless they are explicitly mentioned in the requirements.
//     You should not use any external APIs or services unless they are explicitly mentioned in the requirements.
//     You should not write any code that is not related to the requirements.
//     You should write the code in the language of the requirements.
//     Do not write any explanations or comments.
//     Do not write code that is not syntactically correct.
//     Do not write code that is not valid.
//     Do not write code that is not executable.
//     Do not write code that does not do what the requirements ask.
//     Return only the code.
//   `;

//   const completion: OpenAI.Chat.ChatCompletion =
//     await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [
//         { role: "system", content: systemPrompt },
//         { role: "user", content: userPrompt },
//       ],
//     });

//   const result = completion.choices[0]!.message.content!;

//   return extractCode(result);
// }

// export async function executePrimitive() {
//   const isolate = new Isolate({ memoryLimit: 128 });
//   const context = await isolate.createContext();
//   const global = context.global;
//   await global.set("global", global.derefInto());
//   await global.set("customer_id", 1, { copy: true });

//   const script = await isolate.compileScript(`
//       async function executeQuery(query, values) {
//           // Simulated database call
//           return [{
//               customer_id: 1n,
//               first_name: 'John',
//               last_name: 'Doe',
//               email: 'john.doe@example.com',
//               phone: '123-456-7890',
//               address: '123 Elm St'
//           }];
//       }

//       async function getCustomerById(customer_id) {
//           const query = 'SELECT * FROM customers WHERE customer_id = $1';
//           const result = await executeQuery(query, [customer_id]);
//           return result[0] || null;
//       }

//       getCustomerById(customer_id);
//   `);

//   const result = await script.run(context);
//   return result;
// }
