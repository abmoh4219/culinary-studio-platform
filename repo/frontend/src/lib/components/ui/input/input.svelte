<script lang="ts">
  import { cn } from '$lib/utils';

  export let type = 'text';
  export let className = '';
</script>

<input
  {type}
  class={cn(
    'flex h-10 w-full rounded-md border bg-background px-s3 py-2 text-sm shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
    className
  )}
  {...$$restProps}
/>
