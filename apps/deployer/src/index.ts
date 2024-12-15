import { createServer } from "node:http";
import { createApp, toNodeListener } from "h3";
import apps from "./routers/apps";

export const app = createApp();
app.use(apps);

createServer(toNodeListener(app)).listen(
  `${Number(process.env.DEPLOYER_PORT ?? 3000)}`,
);
console.log(`Server running on port ${process.env.DEPLOYER_PORT ?? 3000}`);
