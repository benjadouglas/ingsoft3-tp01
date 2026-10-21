import { expect, test, type Page } from "@playwright/test";
import { entrar, planNuevo } from "./ayuda";

// page.request comparte cookies con la página: después de entrar, el navegador tiene sesión.
test.beforeEach(async ({ page }) => {
    await entrar(page.request);
});

// Los planes los publica un agente, así que el test los publica por la api (a través del front).
const creados: string[] = [];
async function publicar(page: Page, prefijo: string) {
    const plan = planNuevo(prefijo);
    const alta = await page.request.post("/api/planes", { data: plan.body });
    expect(alta.status()).toBe(201);
    const { id } = await alta.json();
    creados.push(id);
    return { ...plan, id };
}

// Si un test se corta a la mitad, lo que creó no queda en QA para la próxima corrida.
test.afterEach(async ({ page }) => {
    for (const id of creados.splice(0)) {
        const r = await page.request.delete(`/api/planes/${id}`);
        expect([204, 404]).toContain(r.status());
    }
});

// El link del plan en la lista (el título solo también lo lee el anunciador de rutas).
const enLaLista = (page: Page, titulo: string) => page.getByRole("link", { name: titulo });

test("un plan publicado aparece en la lista, y borrarlo lo saca", async ({ page }) => {
    const { titulo } = await publicar(page, "e2e");

    await page.goto("/planes");
    await enLaLista(page, titulo).click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Borrar plan" }).click();

    await expect(page).toHaveURL(/\/planes$/);
    await expect(enLaLista(page, titulo)).toHaveCount(0);
    await page.reload();
    await expect(enLaLista(page, titulo)).toHaveCount(0);
});

test("abrir un plan que no existe muestra el error", async ({ page }) => {
    await page.goto(`/planes/${crypto.randomUUID()}`);
    await expect(page.getByText("Plan no encontrado")).toBeVisible();
});

test("comentar un bloque y refinar deja el plan enviado al agente", async ({ page }) => {
    const { titulo, id } = await publicar(page, "e2e refinar");
    const texto = `comentario ${Date.now()}`;

    await page.goto(`/planes/${id}`);
    await page.getByText(`Alcance de ${titulo}`).click();
    await page.getByPlaceholder("Describir el cambio").fill(texto);
    await page.getByRole("button", { name: "Agregar" }).click();
    await page.getByRole("button", { name: "Refinar" }).click();
    await expect(page.getByText("Enviado. Esperando que el agente lo reciba.")).toBeVisible();

    // Al recargar sigue enviado: el turno quedó guardado en la base, no solo en la pantalla.
    await page.reload();
    await expect(page.getByText("Enviado. Esperando que el agente lo reciba.")).toBeVisible();

    expect((await page.request.delete(`/api/planes/${id}`)).status()).toBe(204);
    await page.goto("/planes");
    await expect(enLaLista(page, titulo)).toHaveCount(0);
});
