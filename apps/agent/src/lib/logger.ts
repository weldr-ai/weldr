import pino, { type Logger as PinoLogger } from "pino";
import pretty from "pino-pretty";

const isDevelopment = process.env.NODE_ENV === "development";

let logger: PinoLogger | undefined;

export interface LoggerOptions {
  base?: Record<string, unknown>;
  tags?: string[];
  extra?: Record<string, unknown>;
  service?: string;
}

export interface TaggedLogOptions {
  tags?: string | string[];
  extra?: Record<string, unknown>;
}

export namespace Logger {
  export function get(options?: LoggerOptions) {
    if (!logger) {
      logger = pino(
        {
          level: process.env.LOG_LEVEL || "info",
          ...(options?.base || {}),
        },
        isDevelopment
          ? pretty({
              colorize: true,
              hideObject: true,
            })
          : undefined,
      );
    }

    const childLogger = logger.child(options?.base || {});
    const baseTags = options?.tags || [];
    const baseExtra = options?.extra || {};

    // Return logger with contextual methods
    return {
      info: (message: string, additionalOptions?: TaggedLogOptions) => {
        const mergedOptions = mergeOptions(
          baseTags,
          baseExtra,
          additionalOptions,
        );
        childLogger.info(
          { ...mergedOptions, message },
          formatMessage(message, mergedOptions),
        );
      },

      error: (message: string, additionalOptions?: TaggedLogOptions) => {
        const mergedOptions = mergeOptions(
          baseTags,
          baseExtra,
          additionalOptions,
        );
        childLogger.error(
          { ...mergedOptions, message },
          formatMessage(message, mergedOptions),
        );
      },

      warn: (message: string, additionalOptions?: TaggedLogOptions) => {
        const mergedOptions = mergeOptions(
          baseTags,
          baseExtra,
          additionalOptions,
        );
        childLogger.warn(
          { ...mergedOptions, message },
          formatMessage(message, mergedOptions),
        );
      },

      debug: (message: string, additionalOptions?: TaggedLogOptions) => {
        const mergedOptions = mergeOptions(
          baseTags,
          baseExtra,
          additionalOptions,
        );
        childLogger.debug(
          { ...mergedOptions, message },
          formatMessage(message, mergedOptions),
        );
      },

      // Expose the underlying pino logger for advanced usage
      raw: childLogger,
    };
  }

  function mergeOptions(
    baseTags: string[],
    baseExtra: Record<string, unknown>,
    additionalOptions?: TaggedLogOptions,
  ): TaggedLogOptions {
    const additionalTags = Array.isArray(additionalOptions?.tags)
      ? additionalOptions.tags
      : additionalOptions?.tags
        ? [additionalOptions.tags]
        : [];

    return {
      tags: [...baseTags, ...additionalTags],
      extra: {
        ...baseExtra,
        ...additionalOptions?.extra,
      },
    };
  }

  function formatMessage(message: string, options?: TaggedLogOptions) {
    return options?.tags && Array.isArray(options.tags)
      ? `[${options.tags.join(", ")}] ${message}`
      : message;
  }

  // Keep the global methods for backward compatibility
  export function info(message: string, options?: TaggedLogOptions) {
    get().info(message, options);
  }

  export function error(message: string, options?: TaggedLogOptions) {
    get().error(message, options);
  }

  export function warn(message: string, options?: TaggedLogOptions) {
    get().warn(message, options);
  }

  export function debug(message: string, options?: TaggedLogOptions) {
    get().debug(message, options);
  }
}
