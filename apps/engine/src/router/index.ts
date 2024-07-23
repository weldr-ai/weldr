import express from "express";

import engineRoutes from "./engine";

const router = express.Router();

router.use("/engine", engineRoutes);

export default router;
