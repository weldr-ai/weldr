/**
 * Redis-based Server-Sent Events (SSE) streaming implementation
 *
 * This module provides real-time streaming capabilities using Redis pub/sub.
 * Redis is REQUIRED - set REDIS_URL environment variable.
 *
 * Features:
 * - Real-time event distribution via Redis pub/sub
 * - Event buffering for late-joining clients (last 100 events)
 * - Automatic cleanup and graceful shutdown
 * - Multi-client support with separate publisher/subscriber connections
 */

import { createClient, type RedisClientType } from "redis";

import { db, desc, eq } from "@weldr/db";
import { streams } from "@weldr/db/schema";
import { Logger } from "@weldr/shared/logger";
import type { SSEEvent } from "@weldr/shared/types";

let redisClient: RedisClientType | null = null;
let redisSubscriber: RedisClientType | null = null;

/**
 * Initialize Redis clients
 */
async function initRedisClients() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL environment variable is required for streaming");
  }

  try {
    // Publisher client
    redisClient = createClient({
      url: process.env.REDIS_URL,
    });

    // Subscriber client (Redis requires separate connections for pub/sub)
    redisSubscriber = createClient({
      url: process.env.REDIS_URL,
    });

    await Promise.all([redisClient.connect(), redisSubscriber.connect()]);

    Logger.info("Redis clients initialized successfully");
  } catch (error) {
    Logger.error("Failed to initialize Redis clients", { error });
    throw error;
  }
}

/**
 * Get Redis client (initialize if needed)
 */
async function getRedisClient(): Promise<RedisClientType> {
  if (!redisClient) {
    await initRedisClients();
  }
  if (!redisClient) {
    throw new Error("Redis client not initialized");
  }
  return redisClient;
}

/**
 * Get Redis subscriber client
 */
async function getRedisSubscriber(): Promise<RedisClientType> {
  if (!redisSubscriber) {
    await initRedisClients();
  }
  if (!redisSubscriber) {
    throw new Error("Redis subscriber not initialized");
  }
  return redisSubscriber;
}

/**
 * Create a stream ID record in the database
 */
export async function createStreamId(params: {
  streamId: string;
  chatId: string;
}) {
  const { streamId, chatId } = params;

  try {
    await db.insert(streams).values({
      id: streamId,
      chatId,
    });
    console.log(`[Stream] Created stream ID ${streamId} for chat ${chatId}`);
  } catch (error) {
    console.error(`[Stream] Failed to create stream ID:`, error);
  }
}

/**
 * Get all stream IDs for a chat (for resumption)
 */
export async function getStreamIdsByChatId(params: {
  chatId: string;
}): Promise<string[]> {
  try {
    const results = await db
      .select({ id: streams.id })
      .from(streams)
      .where(eq(streams.chatId, params.chatId))
      .orderBy(desc(streams.createdAt));

    return results.map((row) => row.id);
  } catch (error) {
    console.error(
      `[Stream] Failed to get stream IDs for chat ${params.chatId}:`,
      error,
    );
    return [];
  }
}

/**
 * Create SSE stream with Redis pub/sub support
 */
export async function createSSEStream(
  streamId: string,
  chatId: string,
): Promise<ReadableStream<string>> {
  Logger.info("Starting SSE stream", { extra: { streamId, chatId } });

  const redis = await getRedisClient();
  const subscriber = await getRedisSubscriber();
  const channelName = `chat:${chatId}:events`;
  let isConnected = true;

  return new ReadableStream<string>({
    async start(controller) {
      // Send connection established event
      const connectedEvent = `data: ${JSON.stringify({
        type: "connected",
        streamId: streamId,
      })}\n\n`;
      controller.enqueue(connectedEvent);

      try {
        // Subscribe to Redis channel for this chat
        await subscriber.subscribe(channelName, (message) => {
          if (!isConnected) return; // Skip if client disconnected

          try {
            const event = JSON.parse(message) as SSEEvent;
            const sseData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(sseData);
          } catch (error) {
            // Check if it's a disconnect error (enqueue failed)
            if (
              error instanceof TypeError &&
              error.message.includes("enqueue")
            ) {
              Logger.info("Client disconnected (enqueue failed)", {
                extra: { streamId, chatId },
              });
              isConnected = false;
              // Delete stream record from database
              db.delete(streams)
                .where(eq(streams.id, streamId))
                .catch((err) => {
                  Logger.error(
                    "Failed to delete stream from database on disconnect",
                    {
                      error: err,
                    },
                  );
                });
            } else {
              Logger.error("Failed to parse Redis message", { error, message });
            }
          }
        });

        // Send any buffered events from Redis
        const bufferedEvents = await redis.lRange(
          `${channelName}:buffer`,
          0,
          -1,
        );
        for (const eventStr of bufferedEvents) {
          if (!isConnected) break;

          try {
            const event = JSON.parse(eventStr) as SSEEvent;
            const sseData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(sseData);
          } catch (error) {
            // Check if it's a disconnect error (enqueue failed)
            if (
              error instanceof TypeError &&
              error.message.includes("enqueue")
            ) {
              Logger.info("Client disconnected during buffer replay", {
                extra: { streamId, chatId },
              });
              isConnected = false;
              // Delete stream record from database
              db.delete(streams)
                .where(eq(streams.id, streamId))
                .catch((err) => {
                  Logger.error("Failed to delete stream from database", {
                    error: err,
                  });
                });
              break;
            } else {
              Logger.error("Failed to parse buffered event", {
                error,
                eventStr,
              });
            }
          }
        }

        Logger.info("Redis streaming initialized", {
          extra: { streamId, chatId, channelName },
        });
      } catch (error) {
        Logger.error("Failed to setup Redis streaming", { error });
        isConnected = false;
        controller.error(error);
      }
    },

    async cancel() {
      Logger.info(`Stream ${streamId} cancelled by client`);
      isConnected = false;

      try {
        await subscriber.unsubscribe(channelName);
        // Delete stream record from database
        await db.delete(streams).where(eq(streams.id, streamId));
        Logger.info(`Deleted stream ${streamId} from database on cancel`);
      } catch (error) {
        Logger.error("Failed to cleanup on stream cancel", { error });
      }
    },
  });
}

/**
 * Cleanup stream writer and delete from database
 */
export async function unregisterStreamWriter(streamId: string): Promise<void> {
  try {
    // Delete stream record from database
    await db.delete(streams).where(eq(streams.id, streamId));
    Logger.info(`Deleted stream ${streamId} from database`);
  } catch (error) {
    Logger.error("Failed to cleanup stream from database", { error, streamId });
  }
}

/**
 * Stream data to active streams for a chat using Redis pub/sub or in-memory fallback
 */
export async function stream(chatId: string, chunk: SSEEvent): Promise<void> {
  const redis = await getRedisClient();
  const channelName = `chat:${chatId}:events`;
  const eventStr = JSON.stringify(chunk);

  try {
    // Publish to Redis channel
    await redis.publish(channelName, eventStr);

    // Buffer the event for late joiners (keep last 100 events)
    const bufferKey = `${channelName}:buffer`;
    await redis.lPush(bufferKey, eventStr);
    await redis.lTrim(bufferKey, 0, 99); // Keep only last 100 events
    await redis.expire(bufferKey, 3600); // Expire buffer after 1 hour

    Logger.debug(`Sent ${chunk.type} via Redis to chat ${chatId}`);
  } catch (error) {
    Logger.error("Failed to publish to Redis", { error });
    throw error;
  }
}

/**
 * Graceful shutdown - close Redis connections
 */
export async function closeRedisConnections(): Promise<void> {
  try {
    if (redisClient) {
      await redisClient.quit();
      redisClient = null;
    }
    if (redisSubscriber) {
      await redisSubscriber.quit();
      redisSubscriber = null;
    }
    Logger.info("Redis connections closed");
  } catch (error) {
    Logger.error("Error closing Redis connections", { error });
  }
}
