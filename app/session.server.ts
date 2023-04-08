import { createSessionStorage } from "@remix-run/node";
import * as crypto from "crypto";
import invariant from "tiny-invariant";
import { redis } from "./redis.server";

invariant(process.env.SESSION_SECRET, "SESSION_SECRET must be set");

export interface UserSessionData {
  auditReport: {
    name: string;
    records: AuditReportRecord[];
  };
}

interface AuditReportRecord {
  packageId?: string;
  version: string;
  isDev: boolean;
}

function expiresToSeconds(expires: Date) {
  const now = new Date();
  const expiresDate = new Date(expires);
  const secondsDelta = Math.floor(
    expiresDate.getTime() / 1000 - now.getTime() / 1000
  );
  return secondsDelta < 0 ? 0 : secondsDelta;
}

function createRedisSessionStorage() {
  return createSessionStorage<UserSessionData>({
    cookie: {
      name: "__session",
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secrets: [process.env.SESSION_SECRET!],
      secure: process.env.NODE_ENV === "production",
      maxAge: 172_800, // 2 days
    },
    async createData(data, expires) {
      const randomBytes = crypto.randomBytes(8);
      const id = Buffer.from(randomBytes).toString("hex");
      if (expires) {
        await redis.set(
          id,
          JSON.stringify(data),
          "EX",
          expiresToSeconds(expires)
        );
      } else {
        await redis.set(id, JSON.stringify(data));
      }
      return id;
    },
    async readData(id) {
      return JSON.parse((await redis.get(id)) ?? "{}");
    },
    async updateData(id, data, expires) {
      if (expires) {
        await redis.set(
          id,
          JSON.stringify(data),
          "EX",
          expiresToSeconds(expires)
        );
      } else {
        await redis.set(id, JSON.stringify(data));
      }
    },
    async deleteData(id) {
      await redis.del(id);
    },
  });
}

export const sessionStorage = createRedisSessionStorage();

export async function updateSession<Key extends keyof UserSessionData & string>(
  request: Request,
  name: Key,
  value: UserSessionData[Key]
) {
  const session = await getSession(request);
  session.set(name, value);
  return await sessionStorage.commitSession(session);
}

export async function removeFromSession<
  Key extends keyof UserSessionData & string
>(request: Request, name: Key) {
  const session = await getSession(request);
  session.unset(name);
  return await sessionStorage.commitSession(session);
}

export async function getSession(request: Request) {
  const cookie = request.headers.get("Cookie");
  return sessionStorage.getSession(cookie);
}
