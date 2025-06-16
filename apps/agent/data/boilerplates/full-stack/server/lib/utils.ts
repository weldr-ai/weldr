import { OpenAPIHono } from "@hono/zod-openapi";
import type { HonoBindings } from "@server/lib/context";
import { router as orpcRouter } from "@server/orpc/router";
import { orpcOpenAPIGenerator } from "@server/orpc/utils";

export function createHonoRouter() {
  return new OpenAPIHono<HonoBindings>();
}

export function configureOpenAPI(app: OpenAPIHono<HonoBindings>) {
  app
    .get("/openapi.json", async (c) => {
      const honoOpenAPISpec = app.getOpenAPI31Document({
        openapi: "3.1.0",
        info: {
          title: "API Documentation",
          version: "1.0.0",
        },
      });

      const orpcOpenAPISpec = await orpcOpenAPIGenerator.generate(orpcRouter);

      const spec = {
        ...orpcOpenAPISpec,
        ...honoOpenAPISpec,
        paths: {
          ...orpcOpenAPISpec.paths,
          ...Object.entries(honoOpenAPISpec.paths ?? {}).reduce(
            (acc, [key, path]) => {
              acc[key.replace(/^\/api/, "")] = path;
              return acc;
            },
            {} as Record<string, unknown>,
          ),
        },
        servers: [
          { url: `${process.env.BASE_URL ?? "http://localhost:3000"}/api` },
        ],
        security: [{ bearerAuth: [] }],
        components: {
          ...orpcOpenAPISpec.components,
          ...honoOpenAPISpec.components,
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
            },
          },
        },
      };

      c.res.headers.set("Content-Type", "application/json");
      return c.json(spec);
    })
    .get("/reference", async (c) => {
      return c.html(`
				<!doctype html>
				<html>
					<head>
						<title>API Reference</title>
						<meta charset="utf-8" />
						<meta name="viewport" content="width=device-width, initial-scale=1" />
						<link rel="icon" type="image/svg+xml" href="${process.env.BASE_URL ?? "http://localhost:3000"}/logo.svg" />
					</head>
					<body>
						<div id="app"></div>
						<script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
						<script>
							Scalar.createApiReference('#app', {
								url: '/api/openapi.json',
								authentication: {
									securitySchemes: {
										bearerAuth: {
											token: 'default-token',
										},
									},
								},
							})
						</script>
					</body>
				</html>`);
    });
}
