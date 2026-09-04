import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { usuarioPorApiKey } from "./services/apiKey";

// baseURL y secret salen de BETTER_AUTH_URL y BETTER_AUTH_SECRET.
// El browser habla con el front (5173), que proxea /api al back: por eso
// BETTER_AUTH_URL apunta al origen del front y el callback de Google es
// <BETTER_AUTH_URL>/api/auth/callback/google.
export const auth = betterAuth({
    appName: "htmlplan",
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: { enabled: false },
    socialProviders: {
        google: {
            prompt: "select_account",
            clientId: process.env.GOOGLE_CLIENT_ID as string,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
    },
});

// Autentica por API key (`Authorization: Bearer`, agente) o por sesión
// (cookie, browser). Devuelve el usuario, o null si no hay credenciales válidas.
export async function authenticate(headers: Headers): Promise<Usuario | null> {
    const bearer = headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if (bearer) return (await usuarioPorApiKey(bearer)) ?? null;
    return (await auth.api.getSession({ headers }))?.user ?? null;
}

export type Usuario = typeof auth.$Infer.Session.user;
