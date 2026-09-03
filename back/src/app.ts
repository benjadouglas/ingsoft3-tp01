import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { generarApiKey, usuarioPorApiKey } from "./services/apiKey";
import {
    listarPlanes,
    obtenerHtmlActual,
    obtenerOCrearProyecto,
    publicarPlan,
} from "./services/planes";

export const app = new Elysia({ prefix: "/api" })
    .all("/auth/*", ({ request }) => auth.handler(request))
    // Rutas con `{ usuario: true }` exigen sesión (cookie, browser) o API key
    // (`Authorization: Bearer`, agente) y reciben `usuario` en el contexto.
    .macro({
        usuario: {
            async resolve({ status, request }) {
                const bearer = request.headers
                    .get("authorization")
                    ?.match(/^Bearer (.+)$/i)?.[1];
                const usuario = bearer
                    ? await usuarioPorApiKey(bearer)
                    : (await auth.api.getSession({ headers: request.headers }))
                          ?.user;
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
            if (request.headers.has("authorization"))
                return status(403, "La API key se genera desde la app");
            return { token: await generarApiKey(usuario.id) };
        },
        { usuario: true },
    )
    .post(
        "/proyectos",
        ({ body, usuario }) => obtenerOCrearProyecto(usuario.id, body.nombre),
        {
            body: t.Object({ nombre: t.String({ minLength: 1 }) }),
            usuario: true,
        },
    )
    .post(
        "/proyectos/:id/planes",
        async ({ params, body, usuario, status }) => {
            const plan = await publicarPlan(usuario.id, {
                proyectoId: params.id,
                ...body,
            });
            if (!plan) return status(404, "Proyecto no encontrado");
            return status(201, {
                id: plan.id,
                url: `/planes/${plan.id}`,
                version: plan.version,
            });
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Object({
                titulo: t.String({ minLength: 1 }),
                contenidoHtml: t.String({ minLength: 1 }),
                sessionId: t.Optional(t.String()),
            }),
            usuario: true,
        },
    )
    .get("/planes", ({ usuario }) => listarPlanes(usuario.id), {
        usuario: true,
    })
    .get(
        "/planes/:id",
        async ({ params, usuario, status }) => {
            const html = await obtenerHtmlActual(usuario.id, params.id);
            if (html === undefined) return status(404, "Plan no encontrado");
            return new Response(html, {
                headers: { "content-type": "text/html; charset=utf-8" },
            });
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            usuario: true,
        },
    );

export type App = typeof app;
