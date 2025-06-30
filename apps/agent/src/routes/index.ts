import { enrichmentRouter } from "./enrichment";
import events from "./events";
import health from "./health";
import trigger from "./trigger";

export const routes = [health, trigger, events, enrichmentRouter];
