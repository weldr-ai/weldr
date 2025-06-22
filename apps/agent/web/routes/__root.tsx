import { createRootRoute, Outlet } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: () => (
    &lt;&gt;
      &lt;Outlet /&gt;
    &lt;/&gt;
  ),
});