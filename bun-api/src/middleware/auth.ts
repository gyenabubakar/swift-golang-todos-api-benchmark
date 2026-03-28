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
  .derive(async ({ headers, jwt, status }) => {
    const authorization = headers.authorization;

    if (!authorization) {
      return {
        authError: () => status(401, { error: "Authorization header required" }),
        authUser: null as AuthUser | null
      };
    }

    const [scheme, token] = authorization.split(" ", 2);
    if (scheme !== "Bearer" || !token) {
      return {
        authError: () => status(401, { error: "Invalid authorization header format" }),
        authUser: null as AuthUser | null
      };
    }

    const payload = (await jwt.verify(token)) as JWTPayload | false;
    if (!payload) {
      return {
        authError: () => status(401, { error: "Invalid or expired token" }),
        authUser: null as AuthUser | null
      };
    }

    const userId = payload.user_id ?? payload.sub;
    if (!userId || !payload.email) {
      return {
        authError: () => status(401, { error: "Invalid or expired token" }),
        authUser: null as AuthUser | null
      };
    }

    return {
      authError: null,
      authUser: {
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
