import { defineConfig } from "@playwright/test";

// Las dos suites corren contra un entorno desplegado (QA en el pipeline):
// E2E_BASE_URL es el front y API_BASE_URL la api, cada una con su URL.
export default defineConfig({
    testDir: "./e2e",
    timeout: 60_000, // el free tier de Render puede tardar en despertar
    expect: { timeout: 15_000 },
    retries: 1, // un test que pasa recién en el reintento sale "flaky" en el reporte
    workers: 1, // QA es uno solo: los tests no se pisan entre sí
    use: {
        baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
        trace: "on-first-retry",
        screenshot: "only-on-failure",
    },
    reporter: [["html", { open: "never" }], ["list"]],
});
