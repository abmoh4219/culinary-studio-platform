<script lang="ts">
  import { cn } from '$lib/utils';

  export let className = '';
</script>

<section
  class={cn('hero-surface text-card-foreground surface-transition', className)}
  {...$$restProps}
>
  <slot />
</section>
