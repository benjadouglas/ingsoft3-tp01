import { Elysia } from "elysia";

const app = new Elysia()
    .get("/", () => "Hello Elysia")
    .get("/health", "<h1>SERVER UP N RUNNING</h1></br><em>why?</em>")
    .listen(3000);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);
