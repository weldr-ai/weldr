import redis from "redis";

export const redisClient = redis.createClient({
  url: process.env.REDIS_URL ?? "redis://localhost:6379",
});

redisClient.on("error", (err) => console.error("Redis Client Error", err));

if (!redisClient.isOpen) {
  redisClient.connect().catch(console.error);
}
