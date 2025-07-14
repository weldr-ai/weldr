import { serve } from "@hono/node-server";
import app from "./api";

const port = Number.parseInt(process.env.PORT || "3000");

const start = async () => {
	try {
		console.info(`API exposed at http://localhost:${port}/`);

		serve({
			fetch: app.fetch,
			port,
		});
	} catch (err) {
		console.error(`Server process received an error: ${err}`, err);
		process.exit(1);
	}
};

process.on("uncaughtException", (err) => {
	console.error(`uncaughtException received: ${err}`, err);
});

start();
