<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { fade } from 'svelte/transition';

  import '../app.css';

  import { initializeMotionPreferences, prefersReducedMotion } from '$lib/motion';
  import { initializeTheme, resolvedTheme, syncSystemTheme } from '$lib/theme';
  import { Toaster } from 'svelte-sonner';

  onMount(() => {
    initializeTheme();
    initializeMotionPreferences();

    const cleanupTheme = syncSystemTheme();
    return () => {
      cleanupTheme();
    };
  });
</script>

<div class="min-h-screen bg-background text-foreground">
  {#key $page.url.pathname}
    <div in:fade={{ duration: $prefersReducedMotion ? 0 : 140 }} out:fade={{ duration: $prefersReducedMotion ? 0 : 120 }}>
      <slot />
    </div>
  {/key}

  <Toaster richColors expand={false} theme={$resolvedTheme} position="top-right" />
</div>
