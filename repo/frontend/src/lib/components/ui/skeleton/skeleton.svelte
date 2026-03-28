<script lang="ts">
  import { cn } from '$lib/utils';

  export let className = '';
</script>

<div
  class={cn(
    'rounded-md bg-muted/70 motion-safe:animate-pulse motion-reduce:animate-none',
    className
  )}
  {...$$restProps}
></div>
