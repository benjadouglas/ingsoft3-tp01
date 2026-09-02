import { createAuthClient } from 'better-auth/svelte';

// Pega contra /api/auth del mismo origen; en dev Vite lo proxea al back.
export const authClient = createAuthClient();

export const signInWithGoogle = () => authClient.signIn.social({ provider: 'google' });

export const signOut = () => authClient.signOut();
