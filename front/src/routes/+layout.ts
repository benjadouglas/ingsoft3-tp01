import { redirect } from '@sveltejs/kit';
import { authClient } from '$lib/auth-client';
import type { LayoutLoad } from './$types';

export const ssr = false;

// Toda ruta exige sesión salvo /login. Corre en el browser (SPA), así que la
// cookie viaja sola en el fetch a /api/auth/get-session.
export const load: LayoutLoad = async ({ url }) => {
	const { data } = await authClient.getSession();
	const enLogin = url.pathname === '/login';

	if (!data && !enLogin) redirect(302, '/login');
	if (data && enLogin) redirect(302, '/');

	return { usuario: data?.user ?? null };
};
