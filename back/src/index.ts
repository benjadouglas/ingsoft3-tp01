import { app } from "./app";
import { migrar } from "./db";

await migrar();
// Bun corta cualquier request que pase `idleTimeout` segundos sin tráfico (10 por
// defecto): mataba el SSE del visor y el long-poll del agente (25s). El SSE además
// manda un latido cada 30s para no llegar nunca al tope.
app.listen({ port: Number(process.env.PORT ?? 3000), idleTimeout: 60 });

console.log(
    `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`,
);
