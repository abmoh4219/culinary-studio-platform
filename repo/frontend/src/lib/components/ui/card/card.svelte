<script lang="ts">
  import { cn } from '$lib/utils';

  export let className = '';
</script>

<section class={cn('rounded-xl border bg-card text-card-foreground shadow-sm', className)} {...$$restProps}>
  <slot />
</section>
