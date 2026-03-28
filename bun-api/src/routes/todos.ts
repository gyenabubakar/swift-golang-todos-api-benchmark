import { Elysia, t } from "elysia";

import { config } from "../config";
import {
  deleteKeys,
  getJson,
  setJson,
  todoCacheKey,
  todosCacheKey
} from "../lib/cache";
import { toTodoResponse } from "../lib/mappers";
import { authPlugin } from "../middleware/auth";
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

const todoIdParams = t.Object({
  id: t.String({
    format: "uuid",
    error: "Invalid todo ID"
  })
});

export const todoRoutes = new Elysia({ prefix: "/todos" })
  .use(authPlugin)
  .get("/", async ({ currentUser }) => {
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
    async ({ body, currentUser, status }) => {
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
  .guard(
    {
      params: todoIdParams
    },
    (app) =>
      app
        .get("/:id", async ({ params, currentUser, status }) => {
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
          async ({ params, body, currentUser, status }) => {
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
        .delete("/:id", async ({ params, currentUser, status }) => {
          const deleted = await deleteTodoById(params.id, currentUser.id);
          if (!deleted) {
            return status(404, { error: "Todo not found" });
          }

          await deleteKeys(todosCacheKey(currentUser.id), todoCacheKey(params.id));

          return new Response(null, { status: 204 });
        })
  )
  .delete("/", async ({ currentUser }) => {
    await deleteAllTodosByUserId(currentUser.id);
    await deleteKeys(todosCacheKey(currentUser.id));

    return new Response(null, { status: 204 });
  });
