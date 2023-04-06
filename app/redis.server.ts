import Redis from "ioredis";
import invariant from "tiny-invariant";

invariant(process.env.REDIS_URL, "REDIS_URL must be set");

export const redis = new Redis(process.env.REDIS_URL);
