import { bearer } from "@elysiajs/bearer";
import { Elysia } from "elysia";

import { jwtPlugin } from "../lib/jwt";

export interface AuthUser {
  id: string;
  email: string;
}

interface JWTPayload {
  sub?: string;
  user_id?: string;
  email?: string;
  iat?: number;
  exp?: number;
}

export const authPlugin = new Elysia()
  .use(jwtPlugin)
  .use(bearer())
  .resolve({ as: "scoped" }, async ({ bearer, headers, jwt, set, status }) => {
    set.headers["WWW-Authenticate"] = `Bearer realm="todos", error="invalid_token"`;

    const authorization = headers.authorization;

    if (!authorization) {
      return status(401, { error: "Authorization header required" });
    }

    if (!bearer) {
      return status(401, { error: "Invalid authorization header format" });
    }

    const payload = (await jwt.verify(bearer)) as JWTPayload | false;
    if (!payload) {
      return status(401, { error: "Invalid or expired token" });
    }

    const userId = payload.user_id ?? payload.sub;
    if (!userId || !payload.email) {
      return status(401, { error: "Invalid or expired token" });
    }

    return {
      currentUser: {
        id: userId,
        email: payload.email
      } satisfies AuthUser
    };
  });

export function getJwtPayload(userId: string, email: string) {
  return {
    sub: userId,
    user_id: userId,
    email
  };
}
