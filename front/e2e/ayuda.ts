import { expect, type APIRequestContext } from "@playwright/test";

// Inicia sesión con el usuario de prueba. La cookie queda en `request`,
// así que los pedidos que siguen (y la página, si es page.request) van autenticados.
export async function entrar(request: APIRequestContext, base = "") {
    const r = await request.post(`${base}/api/auth/sign-in/email`, {
        data: {
            email: process.env.E2E_EMAIL,
            password: process.env.E2E_PASSWORD,
        },
    });
    expect(r.status(), "login del usuario de prueba").toBe(200);
}

// Un plan mínimo, como lo publicaría un agente, con un título que no se repite.
export function planNuevo(prefijo: string) {
    const titulo = `${prefijo} ${Date.now()}`;
    return {
        titulo,
        body: {
            proyecto: "e2e",
            contenidoHtml: `<title>${titulo}</title><h1>${titulo}</h1><p id="alcance">Alcance de ${titulo}</p>`,
            sesion: { harness: "e2e", id: titulo },
        },
    };
}
