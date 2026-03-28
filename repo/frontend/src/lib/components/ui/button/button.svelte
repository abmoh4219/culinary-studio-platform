<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { cva, type VariantProps } from 'class-variance-authority';

  import { cn } from '$lib/utils';

  const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium surface-transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-0',
    {
      variants: {
        variant: {
          default: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-glow',
          secondary: 'border border-border/80 bg-card text-foreground shadow-xs hover:bg-muted/80',
          ghost: 'text-foreground hover:bg-muted/75'
        },
        size: {
          sm: 'h-9 px-3',
          md: 'h-10 px-4',
          lg: 'h-11 px-6'
        }
      },
      defaultVariants: {
        variant: 'default',
        size: 'md'
      }
    }
  );

  type Variant = VariantProps<typeof buttonVariants>['variant'];
  type Size = VariantProps<typeof buttonVariants>['size'];

  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let variant: Variant = 'default';
  export let size: Size = 'md';
  export let className = '';

  const dispatch = createEventDispatcher<{
    click: MouseEvent;
    focus: FocusEvent;
    blur: FocusEvent;
  }>();
</script>

<button
  type={type}
  class={cn(buttonVariants({ variant, size }), className)}
  on:click={(event) => dispatch('click', event)}
  on:focus={(event) => dispatch('focus', event)}
  on:blur={(event) => dispatch('blur', event)}
  {...$$restProps}
>
  <slot />
</button>
