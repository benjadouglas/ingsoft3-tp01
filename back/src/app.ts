import { Elysia, t } from "elysia";
import { publicarPlan } from "./services/planes";

export const app = new Elysia({ prefix: "/api" })
  .get("/health", () => ({ ok: true }))
  .post(
    "/planes",
    async ({ body, set }) => {
      const plan = await publicarPlan(body);
      set.status = 201;
      return { id: plan.id, url: `/planes/${plan.id}` };
    },
    {
      body: t.Object({
        proyecto: t.String({ minLength: 1 }),
        contenidoHtml: t.String({ minLength: 1 }),
      }),
    },
  );

export type App = typeof app;
