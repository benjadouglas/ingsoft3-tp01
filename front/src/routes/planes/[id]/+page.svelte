<script lang="ts">
	let { data } = $props();
</script>

<iframe title="Plan" srcdoc={data.contenidoHtml} sandbox="allow-scripts" class="h-dvh w-full border-0"></iframe>
