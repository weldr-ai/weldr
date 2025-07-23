import events from "./events";
import health from "./health";
import installIntegrations from "./install-integrations";
import trigger from "./trigger";

export const routes = [health, trigger, events, installIntegrations];
