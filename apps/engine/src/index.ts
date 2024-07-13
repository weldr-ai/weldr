import express from "express";

import router from "./router";

const app = express();

app.use((req, _res, next) => {
  console.log("⬅️ ", req.method, req.path, req.body ?? req.query);
  next();
});

app.use("/api", router);

app.get("/", (_req, res) => res.json({ message: "IntegraMind Engine" }));

app.listen(3002, () => {
  console.log("listening on port 3002");
});
