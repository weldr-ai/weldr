import type { z } from "zod";
import OpenAI from "openai";
import { parse } from "pg-connection-string";

import type { postgresMetadataSchema } from "@integramind/db/schema";

import {
  getFunctionPrimitiveWithSecretsById,
  updateFunctionPrimitiveById,
} from "~/lib/queries/primitives";
import { getResourceById } from "~/lib/queries/resources";
import { createPythonJobYaml, createSQLJobYaml } from "~/lib/yaml-generator";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function extractCode(input: string, language: string): string | null {
  const regex = new RegExp(`\`\`\`${language}\\s+([\\s\\S]*?)\\s+\`\`\``);
  const match = input.match(regex);
  if (match?.[1]) {
    return match[1].trim();
  }
  return null;
}

function parsePostgresConnectionString(connectionUrl: string) {
  try {
    const config = parse(connectionUrl);
    return config;
  } catch (error) {
    return null;
  }
}

export async function POST(req: Request) {
  const data = (await req.json()) as {
    id: string;
  };

  const functionPrimitive = await getFunctionPrimitiveWithSecretsById({
    id: data.id,
  });

  if (!functionPrimitive) {
    return Response.json({ error: "Function not found" }, { status: 404 });
  }

  const inputs: {
    name: string;
    value: string | number;
  }[] = [];

  for (const input of functionPrimitive.inputs) {
    if (input.testValue) {
      inputs.push({
        name: input.name.replace(/\s+/g, "_").trim().toUpperCase(),
        value: input.testValue,
      });
    } else {
      return Response.json({ error: "Missing test value" }, { status: 400 });
    }
  }

  let functionCode = functionPrimitive.generatedCode;

  let systemMessage = "";

  if (functionPrimitive.resource) {
    systemMessage = `
      You are an SQL expert. You are given a description of a query and a set of inputs.
      Your task is to write an SQL query that satisfies the function's requirements.
      The query should have placeholders for the inputs because it will be used in a Python script with psycopg2.
      You must only return the SQL query.
      `;
  } else {
    systemMessage = `
      You are a Python expert. You are given a description of a function and a set of inputs.
      Your task is to write a Python function that satisfies the function's requirements.
      You must only return the Python function.
      `;
  }

  if (
    functionPrimitive.description &&
    !functionPrimitive.isLocked &&
    !functionPrimitive.isCodeUpdated
  ) {
    const completion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: systemMessage,
        },
        {
          role: "user",
          content: functionPrimitive.description,
        },
      ],
      model: "gpt-4o",
    });

    const language = functionPrimitive.resource ? "sql" : "python";

    functionCode = extractCode(
      (
        completion.choices[0] as {
          message: { content: string };
        }
      ).message.content,
      language,
    );

    await updateFunctionPrimitiveById({
      id: functionPrimitive.id,
      generatedCode: functionCode,
      isCodeUpdated: true,
    });
  }

  if (!functionCode) {
    return new Response("Bad request", { status: 400 });
  }

  let jobYaml: string;

  if (functionPrimitive.resource) {
    const resource = await getResourceById({
      id: functionPrimitive.resource.id,
    });

    if (!resource) {
      return new Response("Bad request", { status: 400 });
    }

    const connectionString = (
      resource.metadata as z.infer<typeof postgresMetadataSchema>
    ).connectionString;

    const dbConnectionSettings =
      parsePostgresConnectionString(connectionString);

    if (
      !dbConnectionSettings?.host ||
      !dbConnectionSettings?.port ||
      !dbConnectionSettings?.user ||
      !dbConnectionSettings?.password ||
      !dbConnectionSettings?.database
    ) {
      return new Response("Bad request", { status: 400 });
    }

    jobYaml = createSQLJobYaml(functionPrimitive.name, inputs, functionCode, {
      host: dbConnectionSettings.host,
      port: dbConnectionSettings.port,
      user: dbConnectionSettings.user,
      password: dbConnectionSettings.password,
      database: dbConnectionSettings.database,
    });
  } else {
    jobYaml = createPythonJobYaml(functionPrimitive.name, inputs, functionCode);
  }

  const res = await fetch("http://127.0.0.1:8000/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "text/yaml",
    },
    body: jobYaml,
  });

  if (!res.ok) {
    const error = await res.text();
    return new Response(error, {
      status: 500,
    });
  }

  const job = (await res.json()) as {
    id: string;
  };

  return Response.json({ ...job });
}
