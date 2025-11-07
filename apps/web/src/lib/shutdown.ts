import { stopAllDevServers } from "./dev-server-manager";
import { isLocalMode } from "./mode";

let isShuttingDown = false;

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  console.log(`\nReceived ${signal}, shutting down gracefully...`);

  try {
    // Stop all dev servers in local mode
    if (isLocalMode()) {
      console.log("Stopping all dev servers...");
      await stopAllDevServers();
    }
  } catch (error) {
    console.error("Error during graceful shutdown:", error);
  }

  process.exit(0);
}

// Register shutdown handlers
if (typeof process !== "undefined") {
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
}
