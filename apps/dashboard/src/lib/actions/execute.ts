"use server";

import { ofetch } from "ofetch";
import { api } from "../trpc/rsc";

export async function executeFunction({
  functionId,
  input,
}: {
  functionId: string;
  input?: Record<string, unknown> | null | undefined;
}) {
  const functionData = await api.primitives.getById({ id: functionId });

  const name = functionData.name;

  if (!name) {
    return {
      status: "error",
      message: "Please implement your function first",
    };
  }

  const code = functionData?.metadata?.code;

  if (!code) {
    return {
      status: "error",
      message: "Please talk with the assistant to create the function first",
    };
  }

  const resourceIds = functionData.metadata?.resources?.map(
    (resource) => resource.id,
  );

  let dependencies: { name: string; version?: string }[] =
    functionData?.metadata?.dependencies ?? [];

  if (resourceIds && resourceIds.length > 0) {
    dependencies = dependencies.concat(
      await api.integrations.getDependenciesByResourceIds(resourceIds),
    );
  }

  const utilityIds = functionData.metadata?.resources?.reduce(
    (acc, resource) => {
      return acc.concat(resource.utilities.map((utility) => utility.id));
    },
    [] as string[],
  );

  let utilities: { filePath: string; content: string }[] = [];

  if (utilityIds && utilityIds.length > 0) {
    const utilitiesData = await api.integrations.getUtilitiesByIds(utilityIds);
    utilities = utilitiesData.map((utility) => ({
      filePath: utility.filePath,
      content: utility.implementation,
    }));
  }

  const requestBody = {
    functionName: name,
    functionArgs: input,
    code,
    utilities: utilities,
    dependencies,
  };

  console.log("[requestBody]", JSON.stringify(requestBody, null, 2));

  try {
    const executionResult = await ofetch<{ output: Record<string, unknown> }>(
      "http://localhost:3003/",
      {
        method: "POST",
        body: JSON.stringify(requestBody),
        async onRequestError({ request, options, error }) {
          console.log("[fetch request error]", request, error);
          throw new Error("Failed to execute function");
        },
        async onResponseError({ request, response, options }) {
          console.log("[fetch response error]", request, response);
          throw new Error("Failed to execute function");
        },
      },
    );

    console.log("[executionResult]", executionResult);

    await api.primitives.createTestRun({
      input: input ?? {},
      output: executionResult,
      primitiveId: functionId,
    });

    return {
      status: "success",
      output: executionResult,
    };
  } catch (error) {
    console.log("[error]", error);
    return {
      status: "error",
      message: "Failed to execute function",
    };
  }
}
