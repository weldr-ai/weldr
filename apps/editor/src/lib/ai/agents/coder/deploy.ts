// FIXME: This must be changed completely to accommodate the new deployment architecture

import { db } from "@weldr/db";
import { Fly } from "@weldr/shared/fly";

export async function deploy({
  projectId,
  versionId,
}: {
  projectId: string;
  versionId: string;
}) {
  return db.transaction(async (tx) => {
    let machineId: string | undefined;

    try {
      // TODO: Implement
      // Create a new machine
      // Write the project files to the machine
      // Return the machine ID

      return machineId;
    } catch (error) {
      if (machineId) {
        await Fly.machine.destroy({
          type: "production",
          projectId,
          machineId,
        });
      }
      throw error;
    }
  });
}
