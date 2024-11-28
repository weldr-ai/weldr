import { createServer } from "node:http";
import { createApp, toNodeListener } from "h3";
import workspaces from "./routers/workspaces";

export const app = createApp();
app.use(workspaces);

createServer(toNodeListener(app)).listen(
  `${Number(process.env.DEPLOYER_PORT ?? 3000)}`,
);
console.log(`Server running on port ${process.env.DEPLOYER_PORT ?? 3000}`);
