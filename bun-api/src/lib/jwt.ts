import { jwt } from "@elysiajs/jwt";

import { config } from "../config";

export const jwtPlugin = jwt({
  name: "jwt",
  secret: config.jwtSecret,
  alg: "HS256",
  exp: "1d",
  iat: true
});
