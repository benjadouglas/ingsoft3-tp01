import { expect, test, type APIRequestContext } from "@playwright/test";
import { entrar, planNuevo } from "./ayuda";

// La api de verdad, con su base detrás: sin navegador y sin dobles. Sin barra al final.
const API = process.env.API_BASE_URL ?? "http://localhost:3000";

async function planes(request: APIRequestContext) {
    const r = await request.get(`${API}/api/planes`);
    expect(r.status()).toBe(200);
    return (await r.json()) as { id: string; titulo: string; proyecto: string }[];
}

test.beforeEach(async ({ request }) => {
    await entrar(request, API);
});

test("publicar un plan lo guarda en la base, y borrarlo lo saca", async ({ request }) => {
    const { titulo, body } = planNuevo("api");
    const alta = await request.post(`${API}/api/planes`, { data: body });
    expect(alta.status()).toBe(201);
    const { id } = await alta.json();

    expect((await planes(request)).some((p) => p.titulo === titulo)).toBe(true);

    const borrado = await request.delete(`${API}/api/planes/${id}`);
    expect(borrado.status()).toBe(204);
    expect((await planes(request)).some((p) => p.titulo === titulo)).toBe(false);
});

test("un plan sin contenido lo rechaza la api, y no crea nada", async ({ request }) => {
    const proyecto = `api vacio ${Date.now()}`;
    const alta = await request.post(`${API}/api/planes`, {
        data: { proyecto, contenidoHtml: "", sesion: { harness: "e2e", id: proyecto } },
    });
    expect(alta.status()).toBe(400);

    expect((await planes(request)).some((p) => p.proyecto === proyecto)).toBe(false);
});

test("un comentario queda guardado en el plan", async ({ request }) => {
    const { body } = planNuevo("api comentario");
    const { id } = await (await request.post(`${API}/api/planes`, { data: body })).json();
    const texto = `comentario ${Date.now()}`;

    const alta = await request.post(`${API}/api/planes/${id}/comentarios`, {
        data: { bloqueId: "alcance", fragmento: "Alcance", texto },
    });
    expect(alta.status()).toBe(201);
    const comentarios = await (await request.get(`${API}/api/planes/${id}/comentarios`)).json();
    expect(comentarios.some((c: { texto: string }) => c.texto === texto)).toBe(true);

    expect((await request.delete(`${API}/api/planes/${id}`)).status()).toBe(204);
    expect((await request.get(`${API}/api/planes/${id}/comentarios`)).status()).toBe(404);
});
