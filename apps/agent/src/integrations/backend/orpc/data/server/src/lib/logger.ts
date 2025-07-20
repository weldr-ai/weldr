import pino from "pino";
import pretty from "pino-pretty";

const isDevelopment = process.env.NODE_ENV === "development";

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
  },
  isDevelopment ? pretty({ colorize: true, singleLine: true }) : undefined,
);
