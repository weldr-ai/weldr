import express from "express";

import userRoutes from "./engine";

const router = express.Router();

router.use("/engine", userRoutes);

export default router;
