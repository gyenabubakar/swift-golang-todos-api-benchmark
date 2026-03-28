import { Elysia, t } from "elysia";

import { config } from "../config";
import {
  deleteKeys,
  getJson,
  setJson,
  todoCacheKey,
  todosCacheKey
} from "../lib/cache";
import { jwtPlugin } from "../lib/jwt";
import { toTodoResponse } from "../lib/mappers";
import {
  createTodo,
  deleteAllTodosByUserId,
  deleteTodoById,
  findTodoById,
  findTodosByUserId,
  updateTodoById
} from "../repositories/todo";

const createTodoBody = t.Object({
  title: t.String({ minLength: 1 }),
  order: t.Optional(t.Union([t.Number(), t.Null()]))
});

const updateTodoBody = t.Object({
  title: t.Optional(t.String({ minLength: 1 })),
  order: t.Optional(t.Union([t.Number(), t.Null()])),
  completed: t.Optional(t.Boolean())
});

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const todoRoutes = new Elysia({ prefix: "/todos" })
  .use(jwtPlugin)
  .derive(async ({ headers, jwt, status }) => {
    const authorization = headers.authorization;
    if (!authorization) {
      return {
        currentUser: null,
        authFailure: () => status(401, { error: "Authorization header required" })
      };
    }

    const [scheme, token] = authorization.split(" ", 2);
    if (scheme !== "Bearer" || !token) {
      return {
        currentUser: null,
        authFailure: () => status(401, { error: "Invalid authorization header format" })
      };
    }

    const payload = (await jwt.verify(token)) as
      | {
          sub?: string;
          user_id?: string;
          email?: string;
        }
      | false;
    if (!payload) {
      return {
        currentUser: null,
        authFailure: () => status(401, { error: "Invalid or expired token" })
      };
    }

    const userId = payload.user_id ?? payload.sub;
    if (!userId || !payload.email) {
      return {
        currentUser: null,
        authFailure: () => status(401, { error: "Invalid or expired token" })
      };
    }

    return {
      currentUser: {
        id: userId,
        email: payload.email
      },
      authFailure: null
    };
  })
  .get("/", async ({ currentUser, authFailure }) => {
    if (!currentUser) {
      return authFailure?.();
    }

    const cacheKey = todosCacheKey(currentUser.id);
    const cached = await getJson<ReturnType<typeof toTodoResponse>[]>(cacheKey);
    if (cached) {
      return cached;
    }

    const todos = await findTodosByUserId(currentUser.id);
    const response = todos.map((todo) => toTodoResponse(todo, config.baseUrl));

    await setJson(cacheKey, response);
    return response;
  })
  .post(
    "/",
    async ({ body, currentUser, authFailure, status }) => {
      if (!currentUser) {
        return authFailure?.();
      }

      const now = new Date();
      const todo = await createTodo({
        id: crypto.randomUUID(),
        userId: currentUser.id,
        title: body.title,
        order: body.order ?? null,
        completed: false,
        url: null,
        createdAt: now,
        updatedAt: now
      });

      if (!todo) {
        return status(500, { error: "Failed to create todo" });
      }

      await deleteKeys(todosCacheKey(currentUser.id));

      return status(201, toTodoResponse(todo, config.baseUrl));
    },
    {
      body: createTodoBody
    }
  )
  .get("/:id", async ({ params, currentUser, authFailure, status }) => {
      if (!currentUser) {
        return authFailure?.();
      }

      if (!params.id || !uuidPattern.test(params.id)) {
        return status(400, { error: "Invalid todo ID" });
      }

    const cacheKey = todoCacheKey(params.id);
    const cached = await getJson<ReturnType<typeof toTodoResponse>>(cacheKey);
    if (cached) {
      return cached;
    }

    const todo = await findTodoById(params.id, currentUser.id);
    if (!todo) {
      return status(404, { error: "Todo not found" });
    }

    const response = toTodoResponse(todo, config.baseUrl);
    await setJson(cacheKey, response);
    return response;
  })
  .patch(
    "/:id",
    async ({ params, body, currentUser, authFailure, status }) => {
      if (!currentUser) {
        return authFailure?.();
      }

      if (!uuidPattern.test(params.id)) {
        return status(400, { error: "Invalid todo ID" });
      }

      const todo = await updateTodoById(params.id, currentUser.id, body);
      if (!todo) {
        return status(404, { error: "Todo not found" });
      }

      await deleteKeys(todosCacheKey(currentUser.id), todoCacheKey(params.id));

      return toTodoResponse(todo, config.baseUrl);
    },
    {
      body: updateTodoBody
    }
  )
  .delete("/:id", async ({ params, currentUser, authFailure, status }) => {
      if (!currentUser) {
        return authFailure?.();
      }

      if (!uuidPattern.test(params.id)) {
        return status(400, { error: "Invalid todo ID" });
      }

    const deleted = await deleteTodoById(params.id, currentUser.id);
    if (!deleted) {
      return status(404, { error: "Todo not found" });
    }

    await deleteKeys(todosCacheKey(currentUser.id), todoCacheKey(params.id));

    return new Response(null, { status: 204 });
  })
  .delete("/", async ({ currentUser, authFailure }) => {
    if (!currentUser) {
      return authFailure?.();
    }

    await deleteAllTodosByUserId(currentUser.id);
    await deleteKeys(todosCacheKey(currentUser.id));

    return new Response(null, { status: 204 });
  });
