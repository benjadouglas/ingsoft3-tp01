<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { HugeiconsIcon } from '@hugeicons/svelte';
	import { ArrowLeft01Icon } from '@hugeicons/core-free-icons';

	let { data } = $props();
</script>

<div class="flex h-dvh flex-col">
	<div class="flex items-center gap-2 border-b bg-muted/40 px-2 py-1.5">
		<Button variant="ghost" size="sm" href="/planes">
			<HugeiconsIcon icon={ArrowLeft01Icon} data-icon="inline-start" />
			Planes
		</Button>
		<span class="font-mono text-xs text-muted-foreground">{data.id}</span>
	</div>
	<iframe title="Plan" srcdoc={data.contenidoHtml} sandbox="allow-scripts" class="w-full flex-1 border-0"></iframe>
</div>
