<script lang="ts">
  import { cn } from '$lib/utils';

  export let type = 'text';
  export let className = '';
  export let value = '';
</script>

<input
  bind:value
  {type}
  class={cn(
    'flex h-10 w-full rounded-md border border-border/85 bg-background/85 px-s3 py-2 text-sm shadow-xs surface-transition file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...$$restProps}
/>
