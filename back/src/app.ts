import { Elysia, t } from "elysia";
import { auth } from "./auth";
import { generarApiKey, usuarioPorApiKey } from "./services/apiKey";
import {
    comentar,
    crearAccion,
    listarComentarios,
    obtenerHtmlVersion,
    resolverAccion,
    siguienteAccion,
} from "./services/acciones";
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
    )
    .get(
        "/planes/:id/versiones/:n/contenido",
        async ({ params, usuario, status }) => {
            const html = await obtenerHtmlVersion(
                usuario.id,
                params.id,
                params.n,
            );
            if (html === undefined) return status(404, "Versión no encontrada");
            return new Response(html, {
                headers: { "content-type": "text/html; charset=utf-8" },
            });
        },
        {
            params: t.Object({
                id: t.String({ format: "uuid" }),
                n: t.Integer({ minimum: 1 }),
            }),
            usuario: true,
        },
    )
    // Comentarios: solo el dueño, solo en su turno, siempre sobre la versión actual.
    .get(
        "/planes/:id/comentarios",
        async ({ params, usuario, status }) => {
            const lista = await listarComentarios(usuario.id, params.id);
            return lista ?? status(404, "Plan no encontrado");
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            usuario: true,
        },
    )
    .post(
        "/planes/:id/comentarios",
        async ({ params, body, usuario, status }) => {
            const r = await comentar(usuario.id, params.id, body);
            if (r === "no_encontrado") return status(404, "Plan no encontrado");
            if (r === "no_es_tu_turno")
                return status(409, "El plan no está en tu turno");
            return status(201, r);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Union([
                t.Object({ texto: t.String({ minLength: 1 }) }),
                t.Object({
                    bloqueId: t.String({ minLength: 1 }),
                    fragmento: t.String(),
                    texto: t.String({ minLength: 1 }),
                }),
            ]),
            usuario: true,
        },
    )
    // Acciones: el usuario cierra su turno; el agente espera con long-poll y resuelve.
    .post(
        "/planes/:id/acciones",
        async ({ params, body, usuario, status }) => {
            const r = await crearAccion(usuario.id, params.id, body.tipo);
            if (r === "no_encontrado") return status(404, "Plan no encontrado");
            if (r === "no_es_tu_turno")
                return status(409, "El plan no está en tu turno");
            if (r === "pendiente")
                return status(409, "Ya hay una acción pendiente");
            return status(201, r);
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Object({
                tipo: t.Union([t.Literal("refine"), t.Literal("implement")]),
            }),
            usuario: true,
        },
    )
    .get(
        "/planes/:id/acciones/siguiente",
        async ({ params, query, usuario, status }) => {
            const r = await siguienteAccion(
                usuario.id,
                params.id,
                (query.wait ?? 25) * 1000,
            );
            if (r === undefined) return status(404, "Plan no encontrado");
            if (r === null) return status(204);
            return r;
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            query: t.Object({
                wait: t.Optional(t.Integer({ minimum: 0, maximum: 55 })),
            }),
            usuario: true,
        },
    )
    .post(
        "/acciones/:id/resolver",
        async ({ params, body, usuario, status }) => {
            const r = await resolverAccion(
                usuario.id,
                params.id,
                body.contenidoHtml,
            );
            if (r === "no_encontrado")
                return status(404, "Acción no encontrada");
            if (r === "ya_resuelta")
                return status(409, "La acción ya fue resuelta");
            return r;
        },
        {
            params: t.Object({ id: t.String({ format: "uuid" }) }),
            body: t.Object({
                contenidoHtml: t.Optional(t.String({ minLength: 1 })),
            }),
            usuario: true,
        },
    );

export type App = typeof app;
