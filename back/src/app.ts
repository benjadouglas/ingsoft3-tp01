import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { listarPlanes, obtenerPlan, publicarPlan } from "./services/planes";

export const app = new Elysia({ prefix: "/api" })
  .all("/auth/*", ({ request }) => auth.handler(request))
  // Rutas con `{ usuario: true }` exigen sesión y reciben `usuario` en el contexto.
  .macro({
    usuario: {
      async resolve({ status, request }) {
        const sesion = await auth.api.getSession({ headers: request.headers });
        if (!sesion) return status(401);
        return { usuario: sesion.user };
      },
    },
  })
  .get("/health", () => ({ ok: true }))
  .get("/me", ({ usuario }) => usuario, { usuario: true })
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
