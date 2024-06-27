import type { z } from "zod";
import { parse } from "pg-connection-string";

import type { postgresMetadataSchema } from "@integramind/db/schema";

import type {
  FlowEdge,
  FunctionData,
  FunctionMetadata,
  Job,
  Primitive,
} from "~/types";
import { getDataResourceById } from "~/lib/queries/data-resources";
import { getRouteFlowByPath } from "~/lib/queries/flows";
import { getJobById } from "~/lib/queries/run";
import { createPythonJobYaml, createSQLJobYaml } from "~/lib/yaml-generator";

function getExecutionOrder(
  primitives: Primitive[],
  edges: FlowEdge[],
): Primitive[][] {
  // Build adjacency list
  const adjList: Record<string, string[]> = {};
  const inDegree: Record<string, number> = {};

  primitives.forEach((primitive) => {
    adjList[primitive.id] = [];
    inDegree[primitive.id] = 0;
  });

  edges.forEach((edge) => {
    const source = adjList[edge.source];
    if (source) {
      source.push(edge.target);
      inDegree[edge.target]++;
    }
  });

  // Queue for nodes with no incoming edges
  const queue: string[] = [];
  Object.keys(inDegree).forEach((node) => {
    if (inDegree[node] === 0) {
      queue.push(node);
    }
  });

  const sorted: Primitive[][] = [];
  while (queue.length > 0) {
    const level: Primitive[] = [];
    const nextQueue: string[] = [];

    while (queue.length > 0) {
      const node = queue.shift()!;
      const primitive = primitives.find((p) => p.id === node);
      if (primitive) {
        level.push(primitive);
      }

      const neighbors = adjList[node];
      if (neighbors) {
        neighbors.forEach((neighbor) => {
          inDegree[neighbor]--;
          if (inDegree[neighbor] === 0) {
            nextQueue.push(neighbor);
          }
        });
      }
    }

    sorted.push(level);
    queue.push(...nextQueue);
  }

  // Check for cycles
  if (sorted.flat().length !== primitives.length) {
    throw new Error("The graph has at least one cycle.");
  }

  return sorted;
}

function parsePostgresConnectionString(connectionUrl: string) {
  try {
    const config = parse(connectionUrl);
    return config;
  } catch (error) {
    return null;
  }
}

async function getCompletedJob(id: string) {
  return new Promise<Job>((resolve, reject) => {
    const intervalId = setInterval(() => {
      getJobById({ id })
        .then((job) => {
          if (job && job.state === "COMPLETED") {
            clearInterval(intervalId);
            resolve(job);
          }
        })
        .catch((error) => {
          clearInterval(intervalId);
          reject(error);
        });
    }, 1000);
  });
}

const executeFunction = async (
  functionData: FunctionData,
  inputs: {
    name: string;
    value: string | number;
  }[],
) => {
  let jobYaml: string;

  if (functionData.resource) {
    const resource = await getDataResourceById({
      id: functionData.resource.id,
    });

    if (!resource) {
      return { id: null };
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
      return { id: null };
    }

    jobYaml = createSQLJobYaml(
      functionData.name,
      inputs,
      functionData.generatedCode!,
      {
        host: dbConnectionSettings.host,
        port: dbConnectionSettings.port,
        user: dbConnectionSettings.user,
        password: dbConnectionSettings.password,
        database: dbConnectionSettings.database,
      },
    );
  } else {
    jobYaml = createPythonJobYaml(
      functionData.name,
      inputs,
      functionData.generatedCode!,
    );
  }

  const response = await fetch("http://127.0.0.1:8000/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "text/yaml",
    },
    body: jobYaml,
  });

  if (!response.ok || response.status !== 200) {
    return { id: null };
  }

  const job = (await response.json()) as {
    id: string;
  };

  return { id: job.id };
};

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: { workspaceId: string; route: string[] };
  },
) {
  const urlPath = `/${params.route.join("/")}`;
  const route = await getRouteFlowByPath({
    urlPath,
  });

  if (!route) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  if (route.config.actionType !== "read") {
    return Response.json(
      { error: "Method not allowed" },
      {
        status: 405,
      },
    );
  }

  const inputsPerLevel: Record<string, string | number>[] = [];

  if (route.config.inputs) {
    const inputs: Record<string, string | number> =
      (await request.json()) as Record<string, string | number>;
    const data: Record<string, string | number> = {};
    route.config.inputs.forEach((input) => {
      const requestedInput = inputs[input.name];
      if (requestedInput) {
        data[input.name] = requestedInput;
      } else {
        return Response.json({ error: "Missing input" }, { status: 400 });
      }
    });
    inputsPerLevel.push(data);
  }

  const executionOrder = getExecutionOrder(
    route.flow.primitives,
    route.flow.edges,
  );

  const functions = executionOrder.slice(1, executionOrder.length);

  let results;

  for (let idx = 0; idx < functions.length; idx++) {
    const level = functions[idx]!;
    const levelInputs = inputsPerLevel[idx]!;
    const levelResults: Record<string, unknown> = {};

    for (const primitive of level) {
      if (
        primitive.type === "function" &&
        primitive.id !== "js330nn3uu21c6z18lv62gcv"
      ) {
        const functionInputs = primitive.metadata.inputs.reduce(
          (acc, input) => {
            const inputValue = levelInputs[input.name];
            if (inputValue) {
              acc.push({
                name: input.name,
                value: inputValue,
              });
            }
            return acc;
          },
          [] as {
            name: string;
            value: string | number;
          }[],
        );
        if (primitive.description) {
          const execution = await executeFunction(
            {
              id: primitive.id,
              name: primitive.name,
              description: primitive.description,
              type: primitive.type,
              inputs: primitive.metadata.inputs,
              outputs: (primitive.metadata as FunctionMetadata).outputs,
              resource: (primitive.metadata as FunctionMetadata).resource,
              rawDescription: (primitive.metadata as FunctionMetadata)
                .rawDescription,
              isCodeUpdated: (primitive.metadata as FunctionMetadata)
                .isCodeUpdated,
              isLocked: (primitive.metadata as FunctionMetadata).isLocked,
              generatedCode: (primitive.metadata as FunctionMetadata)
                .generatedCode,
            },
            functionInputs,
          );
          const job = await getCompletedJob(execution.id!);
          levelResults[
            primitive.name === "Get All Orders" ? "orders" : "interactions"
          ] = (
            JSON.parse(job.result!) as {
              response: Record<string, string | number>[];
            }
          ).response;
        }
      }
    }

    console.log(levelResults);
    results = { ...levelResults };

    break;
  }

  return Response.json({ ...results });
}
