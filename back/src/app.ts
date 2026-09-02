import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { generarApiKey, usuarioPorApiKey } from "./services/apiKey";
import { listarPlanes, obtenerPlan, publicarPlan } from "./services/planes";

export const app = new Elysia({ prefix: "/api" })
  .all("/auth/*", ({ request }) => auth.handler(request))
  // Rutas con `{ usuario: true }` exigen sesión (cookie, browser) o API key
  // (`Authorization: Bearer`, agente) y reciben `usuario` en el contexto.
  .macro({
    usuario: {
      async resolve({ status, request }) {
        const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
        const usuario = bearer
          ? await usuarioPorApiKey(bearer)
          : (await auth.api.getSession({ headers: request.headers }))?.user;
        if (!usuario) return status(401);
        return { usuario };
      },
    },
  })
  .get("/health", () => ({ ok: true }))
  .get("/me", ({ usuario }) => usuario, { usuario: true })
  // Genera (o regenera, invalidando la anterior) la API key del usuario. Solo con sesión: un agente no puede rotarla.
  .post(
    "/token",
    async ({ usuario, request, status }) => {
      if (request.headers.has("authorization")) return status(403, "La API key se genera desde la app");
      return { token: await generarApiKey(usuario.id) };
    },
    { usuario: true },
  )
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
