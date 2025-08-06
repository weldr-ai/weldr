import health from "./health";
import installIntegrations from "./install-integrations";
import events from "./stream";
import trigger from "./trigger";

export const routes = [health, trigger, events, installIntegrations];
