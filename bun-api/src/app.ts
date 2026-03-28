import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { jwtPlugin } from "./lib/jwt";
import { authRoutes } from "./routes/auth";
import { healthRoutes } from "./routes/health";
import { todoRoutes } from "./routes/todos";

export function createApp() {
  return new Elysia()
    .use(
      cors({
        origin: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Origin", "Content-Type", "Accept", "Authorization"],
        maxAge: 86400
      })
    )
    .onError(({ code, error, set }) => {
      if (code === "VALIDATION") {
        set.status = 400;
        return {
          error: error.message
        };
      }
    })
    .use(jwtPlugin)
    .use(authRoutes)
    .use(todoRoutes)
    .use(healthRoutes);
}
