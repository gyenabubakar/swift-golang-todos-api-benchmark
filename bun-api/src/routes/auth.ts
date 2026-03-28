import { Elysia, t } from "elysia";

import { jwtPlugin } from "../lib/jwt";
import { toUserResponse } from "../lib/mappers";
import { getJwtPayload } from "../middleware/auth";
import { createUser, findUserByEmail } from "../repositories/user";

const registerBody = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 6 }),
  name: t.String({ minLength: 1 })
});

const loginBody = t.Object({
  email: t.String({ format: "email" }),
  password: t.String({ minLength: 1 })
});

export const authRoutes = new Elysia({ prefix: "/auth" })
  .use(jwtPlugin)
  .post(
    "/register",
    async ({ body, jwt, status }) => {
      const existingUser = await findUserByEmail(body.email);
      if (existingUser) {
        return status(409, { error: "Email already registered" });
      }

      const now = new Date();
      const createdUser = await createUser({
        id: crypto.randomUUID(),
        email: body.email,
        passwordHash: await Bun.password.hash(body.password, {
          algorithm: "bcrypt",
          cost: 10
        }),
        name: body.name,
        createdAt: now,
        updatedAt: now
      });

      if (!createdUser) {
        return status(500, { error: "Failed to create user" });
      }

      const token = await jwt.sign(getJwtPayload(createdUser.id, createdUser.email));

      return status(201, {
        token,
        user: toUserResponse(createdUser)
      });
    },
    {
      body: registerBody
    }
  )
  .post(
    "/login",
    async ({ body, jwt, status }) => {
      const user = await findUserByEmail(body.email);
      if (!user) {
        return status(401, { error: "Invalid credentials" });
      }

      const isValid = await Bun.password.verify(body.password, user.passwordHash);
      if (!isValid) {
        return status(401, { error: "Invalid credentials" });
      }

      const token = await jwt.sign(getJwtPayload(user.id, user.email));

      return {
        token,
        user: toUserResponse(user)
      };
    },
    {
      body: loginBody
    }
  );
