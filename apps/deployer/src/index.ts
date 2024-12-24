import { createServer } from "node:http";
import projects from "@/routers/projects";
import { createApp, toNodeListener } from "h3";

export const app = createApp();
app.use(projects);

createServer(toNodeListener(app)).listen(
  `${Number(process.env.DEPLOYER_PORT ?? 3000)}`,
);
console.log(`Server running on port ${process.env.DEPLOYER_PORT ?? 3000}`);
