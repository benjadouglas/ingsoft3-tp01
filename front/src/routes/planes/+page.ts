import type { PageLoad } from './$types';

export const ssr = false;

type PlanResumen = { id: string; proyecto: string; creadoEl: string };

export const load: PageLoad = async ({ fetch }) => {
	const res = await fetch('/api/planes');
	return { planes: (await res.json()) as PlanResumen[] };
};
