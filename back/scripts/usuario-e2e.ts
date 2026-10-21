// Crea (o le cambia la clave a) el usuario con el que entran las e2e e integración.
// Se corre una vez contra la base del entorno:
//   DATABASE_URL=… BETTER_AUTH_SECRET=… bun scripts/usuario-e2e.ts <email> <clave>
import { createLocalAccountIssuer } from "@better-auth/core/db";
import { auth } from "../src/auth";

const [email, clave] = process.argv.slice(2);
if (!email || !clave)
    throw new Error("uso: bun scripts/usuario-e2e.ts <email> <clave>");

const ctx = await auth.$context;
const hash = await ctx.password.hash(clave);
const existente = await ctx.internalAdapter.findUserByEmail(
    email.toLowerCase(),
    {
        includeAccounts: false,
    },
);
if (existente) {
    await ctx.internalAdapter.updatePassword(existente.user.id, hash);
    console.log(`clave actualizada para ${email}`);
} else {
    const usuario = await ctx.internalAdapter.createUser(
        {
            email: email.toLowerCase(),
            name: "e2e",
            emailVerified: true,
        },
        { method: "email-password" },
    );
    await ctx.internalAdapter.linkAccount({
        userId: usuario.id,
        providerId: "credential",
        issuer: createLocalAccountIssuer("credential"),
        accountId: usuario.id,
        password: hash,
    });
    console.log(`usuario creado: ${email}`);
}
process.exit(0);
