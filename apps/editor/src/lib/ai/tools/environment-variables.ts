import { db, eq } from "@weldr/db";
import { environmentVariables } from "@weldr/db/schema";
import { tool } from "ai";
import { z } from "zod";

export const getEnvironmentVariablesTool = tool({
  description: "Get the environment variables for a project.",
  parameters: z.object({
    list: z.literal(true),
  }),
});

export const executeGetEnvironmentVariablesTool = async ({
  projectId,
}: {
  projectId: string;
}) => {
  const environmentVariablesList = await db.query.environmentVariables.findMany(
    {
      where: eq(environmentVariables.projectId, projectId),
    },
  );

  return environmentVariablesList.map(
    (environmentVariable) => environmentVariable.key,
  );
};
