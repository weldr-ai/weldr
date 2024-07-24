import express from "express";

import executorRoutes from "./executor";

const router = express.Router();

router.use("/execute", executorRoutes);

export default router;
