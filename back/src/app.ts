import { Elysia, t } from "elysia";
import { listarPlanes, obtenerPlan, publicarPlan } from "./services/planes";

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
  )
  .get("/planes", () => listarPlanes())
  .get(
    "/planes/:id",
    async ({ params, status }) => {
      const plan = await obtenerPlan(params.id);
      if (!plan) return status(404, "Plan no encontrado");
      return new Response(plan.contenidoHtml, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
    { params: t.Object({ id: t.String({ format: "uuid" }) }) },
  );

export type App = typeof app;
