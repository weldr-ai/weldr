import { db, eq } from "@weldr/db";
import { declarations } from "@weldr/db/schema";
import type { ChatMessage } from "@weldr/shared/types";
import type { CoreAssistantMessage, CoreUserMessage } from "ai";

export async function convertMessagesToCore(messages: ChatMessage[]) {
  const result: (CoreUserMessage | CoreAssistantMessage)[] = [];

  for (const message of messages) {
    // Skip tool messages as they are converted by default
    if (message.role === "tool") {
      result.push({
        role: "assistant",
        content: [
          {
            type: "text",
            text: JSON.stringify(message),
          },
        ],
      });
      continue;
    }

    const content = message.content ?? [];

    // Process content in order, accumulating text content
    let currentTextContent = "";

    const flushTextContent = () => {
      if (currentTextContent.trim()) {
        result.push({
          role: message.role as "user" | "assistant",
          content: [{ type: "text", text: currentTextContent }],
        });
        currentTextContent = "";
      }
    };

    for (const item of content) {
      if (item.type === "text") {
        currentTextContent += item.text;
      }

      if (
        item.type === "reference:function" ||
        item.type === "reference:model" ||
        item.type === "reference:component" ||
        item.type === "reference:endpoint"
      ) {
        const reference = await db.query.declarations.findFirst({
          where: eq(declarations.id, item.id),
          with: {
            file: true,
            declarationPackages: {
              with: {
                package: true,
              },
            },
            dependents: {
              with: {
                dependent: {
                  with: {
                    file: true,
                  },
                },
              },
            },
            dependencies: {
              with: {
                dependency: {
                  with: {
                    file: true,
                  },
                },
              },
            },
          },
        });

        const groupedDependencies = reference?.dependencies.reduce(
          (acc, d) => {
            const accFile = acc[d.dependency.file.path];

            if (!accFile) {
              acc[d.dependency.file.path] = [];
            }

            accFile?.push(d.dependency);

            return acc;
          },
          {} as Record<
            string,
            (typeof reference.dependencies)[number]["dependency"][]
          >,
        );

        const groupedDependents = reference?.dependents.reduce(
          (acc, d) => {
            const accFile = acc[d.dependent.file.path];

            if (!accFile) {
              acc[d.dependent.file.path] = [];
            }

            accFile?.push(d.dependent);

            return acc;
          },
          {} as Record<
            string,
            (typeof reference.dependents)[number]["dependent"][]
          >,
        );

        if (!reference) {
          continue;
        }

        if (reference) {
          currentTextContent += `${reference.name}
Type: ${reference.type}
File: ${reference.file.path}
${
  groupedDependencies && Object.keys(groupedDependencies).length > 0
    ? `Dependencies: ${Object.entries(groupedDependencies)
        .map(
          ([f, ds]) =>
            `From file: ${f} => ${ds?.map((d) => d.name).join(", ")}`,
        )
        .join(", ")}`
    : ""
}
${
  groupedDependents && Object.keys(groupedDependents).length > 0
    ? `Dependents: ${Object.entries(groupedDependents)
        .map(
          ([f, ds]) => `To file: ${f} => ${ds?.map((d) => d.name).join(", ")}`,
        )
        .join(", ")}`
    : ""
}
${reference.declarationPackages.length > 0 ? `External Packages: ${reference.declarationPackages.map((d) => `Depends on these declarations: [${d.declarations?.join(", ")}] from package: ${d.package.name}`).join(", ")}` : ""}`;
        }
      }

      if (item.type === "file") {
        // Flush any accumulated text content before adding the file
        flushTextContent();

        result.push({
          role: message.role as "user",
          content: [{ type: "file", data: item.data, mimeType: item.mimeType }],
        });
      }

      if (item.type === "image") {
        // Flush any accumulated text content before adding the image
        flushTextContent();

        result.push({
          role: message.role as "user",
          content: [
            { type: "image", image: item.image, mimeType: item.mimeType },
          ],
        });
      }

      if (item.type === "tool-call") {
        // Convert tool call to XML format and append to text content
        const argsXml = Object.entries(item.args)
          .map(([key, value]) => `  <${key}>${value}</${key}>`)
          .join("\n");

        currentTextContent += `\n<${item.toolName}>\n${argsXml}\n</${item.toolName}>`;
      }
    }

    // Flush any remaining text content
    flushTextContent();
  }

  return result;
}
