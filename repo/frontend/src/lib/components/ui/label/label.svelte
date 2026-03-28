<script lang="ts">
  import { cn } from '$lib/utils';

  export let className = '';
</script>

<label
  class={cn(
    'text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
    className
  )}
  {...$$restProps}
>
  <slot />
</label>
