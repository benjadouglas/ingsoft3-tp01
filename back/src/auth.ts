import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";

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

export type Usuario = typeof auth.$Infer.Session.user;
