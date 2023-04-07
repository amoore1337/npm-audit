import Redis from "ioredis";
import invariant from "tiny-invariant";

invariant(process.env.REDIS_URL, "REDIS_URL must be set");

function initRedis() {
  if (process.env.NODE_ENV === "production") {
    return new Redis({
      ...parsedRedisUrl(process.env.REDIS_URL!),
      family: 6, // Need to instruct to use IPv6 in Prod
    });
  } else {
    return new Redis(process.env.REDIS_URL!);
  }
}

// Lol, I'm sure there's a lib that can handle this.
// But this works and is simple enough I guess.
function parsedRedisUrl(url: string) {
  const [, str] = url.split("redis://");
  const [, ...rest] = str.split(":");
  const [password, host] = rest.join("").split("@");

  return { password, host };
}

export const redis = initRedis();
