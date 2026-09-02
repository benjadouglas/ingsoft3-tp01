import { app } from "./app";
import { migrar } from "./db";

await migrar();
app.listen(Number(process.env.PORT ?? 3000));

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
