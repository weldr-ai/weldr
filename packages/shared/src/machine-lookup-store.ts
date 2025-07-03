import redis from "redis";

export const machineLookupStore = redis.createClient({
  url: process.env.MACHINES_LOOKUP_REDIS_URL ?? "redis://localhost:6379",
});

machineLookupStore.on("error", (err) =>
  console.error("Redis Client Error", err),
);

if (!machineLookupStore.isOpen) {
  machineLookupStore.connect().catch(console.error);
}
