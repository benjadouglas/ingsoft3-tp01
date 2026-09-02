import { error } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch(`/api/planes/${params.id}`);
	if (!res.ok) error(res.status, 'Plan no encontrado');
	return { id: params.id, contenidoHtml: await res.text() };
};
