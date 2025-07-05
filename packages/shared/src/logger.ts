import pino from "pino";
import pinoCaller from "pino-caller";
import pretty from "pino-pretty";

const isDevelopment = process.env.NODE_ENV === "development";

export namespace Logger {
  const baseLogger = pino(
    {
      level: process.env.LOG_LEVEL || "info",
    },
    isDevelopment ? pretty({ colorize: true, singleLine: true }) : undefined,
  );

  export const instance = isDevelopment
    ? pinoCaller(baseLogger, { relativeTo: __dirname })
    : pinoCaller(baseLogger, { relativeTo: process.cwd() });

  export const get = (options?: Record<string, unknown>) => {
    return instance.child(options || {});
  };

  export const debug = (message: string, data?: Record<string, unknown>) =>
    instance.debug(data || {}, message);

  export const error = (message: string, data?: Record<string, unknown>) =>
    instance.error(data || {}, message);

  export const fatal = (message: string, data?: Record<string, unknown>) =>
    instance.fatal(data || {}, message);

  export const info = (message: string, data?: Record<string, unknown>) =>
    instance.info(data || {}, message);

  export const trace = (message: string, data?: Record<string, unknown>) =>
    instance.trace(data || {}, message);

  export const warn = (message: string, data?: Record<string, unknown>) =>
    instance.warn(data || {}, message);
}
